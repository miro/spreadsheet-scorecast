
var request         = require('request');
var _               = require('lodash');
var monk            = require('monk');
var Spreadsheets    = require("google-spreadsheets"); // Google Spreadsheet crawler


// Our own config file
var config = require(__dirname + '/scorecast-config.js'); 

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

    scrapedMatches: {},
    dbMatches: null,
    groupsDone: 0,
    newMatchesCount: 0,
    newMatchesAnnounced: 0,
    groupQueue: [],

    // Loads existing matches from the DB or inits the DB
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
        _.each(config.worksheets, function(sheetCfg) {
            console.log('Worksheet (' + sheetCfg.sheetIndex + ' / ' + sheetCfg.sheetGroupName + ' processing started');


            // Fetch cells from this specific worksheet
            spreadsheet.worksheets[sheetCfg.sheetIndex].cells(
                { range: 
                    'R' + sheetCfg.leftBorder +
                    'C' + sheetCfg.topBorder +
                    ':R' + sheetCfg.rightBorder +
                    'C' + sheetCfg.bottomBorder
                }, 

                function success(error, result) {
                    if (error) {
                        console.log('## Error while fetching cells from the sheet' + sheetCfg.sheetIndex);
                        console.log('Processing of this sheet is aborted');
                    }
                    else {
                        scorecast.processCells(result.cells, sheetCfg);
                    }
                }
            );
        });
    },


    // This function is for processing individual worksheet
    processCells: function(cells, sheetCfg) {
        // Create match objects from scraped content
        this.getValidMatches(cells, sheetCfg);
        
    },

    getValidMatches: function(rows, sheetCfg) {
        var finishedMatches = _.filter(rows, function(row) {
            var homePoints = _.find(row, function(cell) {
                return cell.col === sheetCfg.homePointsCol;
            });
            homePoints = parseInt(homePoints.value, 10);

            var awayPoints = _.find(row, function(cell) {
                return cell.col === sheetCfg.awayPointsCol;
            });
            awayPoints = parseInt(awayPoints.value, 10);

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
        console.log('----------');
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
                    console.log('Error - saving new matches to DB didn\'t work out');
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
        if (this.groupsDone >= cfg.sheetCfg.size && this.newMatchesCount === this.newMatchesAnnounced) {
            console.log('*** all sheets processed and all new matches announced - time to exit');
            process.exit(0);
        }
    },

    announceNewMatches: function(newMatches) {
        var self = this;
        _.each(newMatches, function(newMatch) {

            // Form the HTML-formatted content information
            var title = 'Group ' + newMatch.group.charAt(0).toUpperCase() + ' - Match ' + newMatch.id;
            var content = '<p>' + 
                newMatch.homePlayer + ' (' + newMatch.homeTeam + ') vs ' + 
                newMatch.awayPlayer + ' (' + newMatch.awayTeam + ')</p> ';
            content += '<h1>' + newMatch.homeGoals + ' - ' + newMatch.awayGoals;
            content += newMatch.overtime ? ' OT' : '';
            content += '</h1>';
            content += '<p>See standings from the <a href="' + config.spreadsheetLink + '">Spreadsheet</a></p>';

            // Send them to Flowdock
            request({
                uri: config.flowdockUrl,
                method: "POST",
                json: {
                    "source": config.senderTitle,
                    "from_address": config.senderEmail, 
                    "subject": title,
                    "content": content,
                    "tags":  ['groupstage', 'group-' + newMatch.group, 'game' + newMatch.id]
                }
            }, function(error, response, body) {
                console.log(body); // If this is empty, alles gut
                self.newMatchesAnnounced += 1;
                self.exitIfPossible();
            });
        });
        
    },

    getMatchesFromDB: function() {
        var self = this;
        var collection = db.get('matches');
        var matchesInDB = collection.find({}, {id: 1, _id: 0},
            function (err, cursor) {
                self.dbMatches = cursor;
                self.getNewMatches();
            }
        );
    },


    createMatchObjects: function(finishedMatchesRows, sheetCfg) {
        this.matches = [];

        _.forEach(finishedMatchesRows, function(row) {
            var tempMatch = {
                group: sheetCfg.sheetGroupName,
                type: sheetCfg.sheetGroupType,

                id: row[sheetCfg.dataCols.id],
                date: row[sheetCfg.dataCols.date],
                
                
                homeTeam: row[sheetCfg.dataCols.homeTeam],
                homePlayer: row[sheetCfg.dataCols.homePlayer],
                homeGoals: row[sheetCfg.dataCols.homeGoals],

                awayGoals: row[sheetCfg.dataCols.awayGoals],
                awayPlayer: row[sheetCfg.dataCols.awayPlayer],
                awayTeam: row[sheetCfg.dataCols.1awayTeam],

                overtime: !!row[sheetCfg.dataCols.overtime] && !!row[sheetCfg.dataCols.overtime].value,

                homePoints: row[sheetCfg.dataCols.homePoints],
                awayPoints: row[sheetCfg.dataCols.awayPoints]
            };

            this.matches.push(tempMatch);
        }, this);

        return this.matches;
    }
};




// ### Start cracking up

function main() {
    scorecast.initializeDatabase();

    // Fetch the sheet
    Spreadsheets(
        { key: config.spreadsheetShareUrl },

        function fetchReady(err, spreadsheet) {

            if (err) {
                console.log('## Error occurred while fetching the spreadsheet, aborting');
                console.log(err);
            }
            else {
                // Start processing the sheet
                scorecast.processSpreadsheet(spreadsheet);
            }
        }
    );

};

main();




