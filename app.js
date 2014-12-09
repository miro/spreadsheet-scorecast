// "General" modules
var request = require('request');
var _       = require('lodash');
var monk    = require('monk');

// Our own config file
var scorecastConfig = require('./scorecast-config'); // TODO __dirname

// Connect to database
var db = monk(
    scorecastConfig.database.address + 
    ':' + 
    scorecastConfig.database.port + 
    '/' + 
    scorecastConfig.database.name
); 

// Google Spreadsheet crawler
var Spreadsheets = require("google-spreadsheets");



console.log("Scorecast starting @ " + Date());

var scorecast = {

    scrapedMatches: {},
    dbMatches: null,
    groupsDone: 0,
    newMatchesCount: 0,
    newMatchesAnnounced: 0,
    groupQueue: [],

    processWorksheet: function(worksheet, spreadsheetNum) {
        // Create match objects from scraped content
        this.getValidMatches(worksheet, spreadsheetNum);

        // Start query that gets saved matches from the DB
        if (!this.dbMatches) {
            this.getMatchesFromDB();
        }
        else {
            this.getNewMatches();
        }
    },

    getValidMatches: function(rows, spreadsheetNum) {
        var finishedMatches = _.filter(rows, function(row) {
            var homePoints = _.find(row, function(cell) {
                return cell.col === '12'; // TODO get from const
            });
            homePoints = parseInt(homePoints.value, 10);

            var awayPoints = _.find(row, function(cell) {
                return cell.col === '13'; // TODO get from const
            });
            awayPoints = parseInt(awayPoints.value, 10);

            return awayPoints != 0 || homePoints != 0;
        });

        // Add this to our scraped matches object 
        this.scrapedMatches[this.spreadsheetNumToGroup(spreadsheetNum)] = this.createMatchObjects(finishedMatches, spreadsheetNum);

        // Find out the new matches from these
        this.getNewMatches(this.spreadsheetNumToGroup(spreadsheetNum));
    },

    getNewMatches: function(groupName) {
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
        console.log('Group ' + groupName + ' has all data ready, start processing');

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
            newMatch["dateCreated"] = new Date();
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
                    console.log("Error - saving new matches to DB didn't work out");
                }
                else {
                    console.log(newMatches.length + " new matches saved to the DB.");
                    self.groupsDone += 1;
                    self.exitIfPossible();
                }
            });
        }
        else {
            console.log("No new matches for Group " + groupName);
            self.groupsDone += 1;
            self.exitIfPossible();
        }
    },

    exitIfPossible: function() {
        if (this.groupsDone >= 4 && this.newMatchesCount === this.newMatchesAnnounced) {
            console.log('*** 4 groups processed and all new matches announced - time to exit');
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
            content += '<p>See standings from the <a href="' + scorecastConfig.spreadsheetLink + '">Spreadsheet</a></p>';

            // Send them to Flowdock
            request({
                uri: scorecastConfig.flowdockUrl,
                method: "POST",
                json: {
                    "source": scorecastConfig.senderTitle,
                    "from_address": scorecastConfig.senderEmail, 
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


    createMatchObjects: function(finishedMatchesRows, spreadsheetNum) {
        this.matches = new Array;

        _.forEach(finishedMatchesRows, function(row) {
            var tempMatch = {
                id: row[2].value,
                date: row[3].value,
                group: this.spreadsheetNumToGroup(spreadsheetNum),
                
                homeTeam: row[4].value,
                homePlayer: row[5].value,
                homeGoals: row[6].value,
                // 7 = row delimiter
                awayGoals: row[8].value,
                awayPlayer: row[9].value,
                awayTeam: row[10].value,

                overtime: !!row[11] && !!row[11].value,

                homePoints: row[12].value,
                awayPoints: row[13].value
            };

            this.matches.push(tempMatch);
        }, this);

        return this.matches;
    },

    spreadsheetNumToGroup: function(worksheetNum) {
        switch(String(worksheetNum)) {
            case '2':
                return 'a';
            case '3':
                return 'b';
            case '4':
                return 'c';
            case '5':
                return 'd';
            default:
                console.log('ERROR - creating group code from worksheet number failed');
                return null;
        }
    }
};


// Crawl the data from each group standing sheet
// TODO: optimize this to use only one request...
Spreadsheets(
    {
        key: scorecastConfig.spreadsheetKey
    },

    function(err, spreadsheet) {
        console.log("Worksheet 4 fetch start");
        spreadsheet.worksheets[4].cells({
            range: "R4C2:R16C13"
        }, 

        function(err, result) {
            console.log("Worksheet 4 fetched");
            scorecast.processWorksheet(result.cells, 4);
        });
    }
);

Spreadsheets(
    {
        key: scorecastConfig.spreadsheetKey
    },

    function(err, spreadsheet) {
        console.log("Worksheet 3 fetch start");
        spreadsheet.worksheets[3].cells({
            range: "R4C2:R16C13"
        }, 

        function(err, result) {
            console.log("Worksheet 3 fetched");
            scorecast.processWorksheet(result.cells, 3);
        });
    }
);

Spreadsheets(
    {
        key: scorecastConfig.spreadsheetKey
    },

    function(err, spreadsheet) {
        console.log("Worksheet 2 fetch start");
        spreadsheet.worksheets[2].cells({
            range: "R4C2:R16C13"
        }, 

        function(err, result) {
            console.log("Worksheet 2 fetched");
            scorecast.processWorksheet(result.cells, 2);
        });
    }
);


Spreadsheets(
    {
        key: scorecastConfig.spreadsheetKey
    },

    function(err, spreadsheet) {
        console.log("Worksheet 5 fetch start");
        spreadsheet.worksheets[5].cells({
            range: "R4C2:R16C13"
        }, 

        function(err, result) {
            console.log("Worksheet 5 fetched");
            scorecast.processWorksheet(result.cells, 5);
        });
    }
);


