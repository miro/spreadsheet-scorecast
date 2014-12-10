
var request         = require('request');
var _               = require('lodash');
var monk            = require('monk');
var Spreadsheets    = require('google-spreadsheets'); // Google Spreadsheet crawler

var config = require(__dirname + '/scorecast-config.js'); // Instance specific config

// Connect to database
var db = monk(
    config.database.address + 
    ':' + 
    config.database.port + 
    '/' + 
    config.database.name
); 




console.log("Scorecast starting @ " + Date());

var scorecast = {

    // "State" for this script
    scrapedMatches: {},
    dbMatches: null,
    groupsDone: 0,
    newMatchesCount: 0,
    newMatchesAnnounced: 0,
    groupQueue: [],

    // Loads existing matches from the DB or inits the DB
    // This function seems to be quite funny(unrational). Actually, what the hell?
    initializeDatabase: function initializeDatabase() {
        // Fetch DB data or init the DB
        if (!this.dbMatches) {
            this.getMatchesFromDB();
        }
        else {
            this.getNewMatches();
        }
    },


    // This function is for processing the WHOLE spreadsheet. 
    // Parameter spreadsheet is the object rqeuested via the Spreadsheet module
    processSpreadsheet: function(spreadsheet) {

        // Start going through the sheets
        _.each(config.worksheets, function processSheet(sheetCfg) {
            console.log('Worksheet ' + sheetCfg.sheetIndex + ' / ' + sheetCfg.sheetGroupName + ' processing started');

            var cellRange = 
                'R' + sheetCfg.area.topBorder +
                'C' + sheetCfg.area.leftBorder +
                ':R' + sheetCfg.area.bottomBorder +
                'C' + sheetCfg.area.rightBorder;

            // Fetch cells from this specific worksheet
            spreadsheet.worksheets[sheetCfg.sheetIndex].cells(
                { range: cellRange }, 

                function success(error, result) {
                    if (error) {
                        console.log('## Error while fetching cells from the sheet ' + sheetCfg.sheetIndex);
                        console.log('Processing of this sheet is aborted');
                        console.log(error);
                    }
                    else {
                        scorecast.processCells(result.cells, sheetCfg);
                    }
                }
            );
        });
    },


    // This function is for processing individual worksheet
    processCells: function(rows, sheetCfg) {

        var finishedMatches = _.filter(rows, function(row) {

            var homePointsCell = _.find(row, function(cell) {
                return cell.col == sheetCfg.dataCols.homePoints; // use == instead of ===, columns are configured in integers but they are strings on the row object
            });
            var homePoints = parseInt(homePointsCell.value, 10);

            var awayPointsCell = _.find(row, function(cell) {
                return cell.col == sheetCfg.dataCols.awayPoints;
            });
            var awayPoints = parseInt(awayPointsCell.value, 10);

            // If this match has both awayPoints and homePoints, it is qualified as a "finished match"
            return awayPoints != 0 || homePoints != 0; 
        });

        // Add this to our scraped matches object 
        this.scrapedMatches[sheetCfg.sheetGroupName] = this.createMatchObjects(finishedMatches, sheetCfg);

        // Find out the new matches from these
        this.getNewMatches(sheetCfg.sheetGroupName);
    },

    getNewMatches: function(groupName) {
        // Right now I have no idea what this queue stuff does... Seems to work! :--D
        var self = this;

        if (!this.dbMatches) {
            if (groupName) this.groupQueue.push(groupName);
            return;
        }

        // If groupName is not given, take the latest one from the queue
        groupName = groupName ? groupName : this.groupQueue.shift();

        if (!this.scrapedMatches[groupName]) {
            if (groupName) this.groupQueue.push(groupName);
            return; 
        }
        
        // If we get here, we have DB results and scraped matches from this group
        console.log('Sheet for ' + groupName + ' has all data ready, start processing');

        // Filter new matches
        var newMatches = _.filter(self.scrapedMatches[groupName], function(match) {
            var isNewMatch = true;
            _.each(self.dbMatches, function(dbMatch) {
                if (dbMatch.id === match.id) {
                    // Found old match with same id - this is unwanted
                    isNewMatch = false;
                }
            });
            return isNewMatch; // If we get here, this must be a new match
        });

        // Update new match count 
        this.newMatchesCount += newMatches.length;

        // Add timestamp to new matches
        _.each(newMatches, function(newMatch) {
            newMatch['dateCreated'] = new Date();
        });

        // Shout new matches to Flowdock
        this.announceNewMatches(newMatches);

        // Insert new matches to the DB, if there are any
        if (newMatches.length > 0) {
            var collection = db.get('matches');
            collection.insert(
                newMatches,

                function (err, doc) {
                if (err) {
                    console.log('### Error - saving new matches to DB didn\'t work out');
                    console.log('### This will cause duplicate announcements!!');
                }
                else {
                    console.log(newMatches.length + ' new matches saved to the DB.');
                    self.groupsDone += 1;
                    self.exitIfPossible();
                }
            });
        }
        else {
            console.log('No new matches for ' + groupName);
            self.groupsDone += 1;
            self.exitIfPossible();
        }
    },

    exitIfPossible: function() {
        if (this.groupsDone >= config.worksheets.length && this.newMatchesCount === this.newMatchesAnnounced) {
            console.log('# All sheets processed and all new matches announced - time to exit');
            process.exit(0);
        }
    },

    announceNewMatches: function(newMatches) {
        var self = this;
        _.each(newMatches, function(newMatch) {

            // Form the HTML-formatted content for Flowdoge
            var title = 
                'Match ' + newMatch.id + ' - ' +
                newMatch.homePlayer + ' vs ' + newMatch.awayPlayer + ' - ' + 
                newMatch.group;
            
            var content = '<h1>' + newMatch.homeGoals + ' - ' + newMatch.awayGoals;
            content += newMatch.overtime ? ' OT' : '';
            content += '  </h1>'; // There is extra whitespace here so it would look better on Flowdoge's Team Inbox

            content += 
                '<b>' + 
                    newMatch.homePlayer + ' (' + newMatch.homeTeam + ') vs ' + 
                    newMatch.awayPlayer + ' (' + newMatch.awayTeam + ')'+ 
                '</b> ';
            
            content += '<p>See standings from the <a href="' + config.spreadsheetLink + '">Spreadsheet</a></p>';
            // TODO: it would be awesome if we could get the current standings here!

            // Send them to Flowdock
            request({
                uri: 'https://api.flowdock.com/v1/messages/team_inbox/' + config.flowdockApiKey,
                method: 'POST',
                json: {
                    'source': config.senderTitle,
                    'from_address': config.senderEmail,
                    'subject': title,
                    'content': content,
                    'tags':  [newMatch.type.split(' ').join(''), newMatch.group.split(' ').join('-'), 'game' + newMatch.id]
                }
            }, function(error, response, body) {
                if (error) {
                    console.log('### Error on Flowdock match announcing!', error);
                }

                self.newMatchesAnnounced += 1;
                self.exitIfPossible();
            });
        });
        
    },

    getMatchesFromDB: function(callback) {
        var self = this;
        var collection = db.get('matches');
        var matchesInDB = collection.find({}, {id: 1, _id: 0},
            function (error, cursor) {
                if (error) {
                    console.log('### Error while fetching matches from the database, aborting');
                    console.log(error);
                    process.exit(1);
                }
                else {
                    self.dbMatches = cursor;
                    self.getNewMatches();
                }
            }
        );
    },


    createMatchObjects: function(finishedMatchesRows, sheetCfg) {
        this.matches = [];

        _.forEach(finishedMatchesRows, function(row) {
            var tempMatch = {
                group: sheetCfg.sheetGroupName,
                type: sheetCfg.sheetGroupType,

                id: row[sheetCfg.dataCols.id].value,
                date: row[sheetCfg.dataCols.date].value,
                
                
                homeTeam: row[sheetCfg.dataCols.homeTeam].value,
                homePlayer: row[sheetCfg.dataCols.homePlayer].value,
                homeGoals: row[sheetCfg.dataCols.homeGoals].value,

                awayGoals: row[sheetCfg.dataCols.awayGoals].value,
                awayPlayer: row[sheetCfg.dataCols.awayPlayer].value,
                awayTeam: row[sheetCfg.dataCols.awayTeam].value,

                overtime: !!row[sheetCfg.dataCols.overtime] && !!row[sheetCfg.dataCols.overtime].value,

                homePoints: row[sheetCfg.dataCols.homePoints].value,
                awayPoints: row[sheetCfg.dataCols.awayPoints].value
            };

            this.matches.push(tempMatch);
        }, this);

        return this.matches;
    }
};


function main() {
    scorecast.initializeDatabase();

    // Fetch the sheet
    console.log('Fetching the Spreadsheet started');
    Spreadsheets(
        { key: config.spreadsheetKey },
        function fetchDone(err, spreadsheet) {
            if (err) {
                console.log('## Error occurred while fetching the spreadsheet, aborting');
                console.log(err);
                process.exit(1);
            }
            else {
                // Start processing the sheet
                console.log('Fetching the Spreadsheet finished');
                scorecast.processSpreadsheet(spreadsheet);
            }
        }
    );
};

// ### Start cracking up
main();

