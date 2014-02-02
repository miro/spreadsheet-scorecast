// "General" modules
var request = require('request');
var _ = require('lodash');

// MongoDB stuff
var mongo = require('mongodb');
var monk = require('monk');
var db = monk('localhost:27017/fhl-groupstage');

// Google Spreadsheet crawler
var Spreadsheets = require("google-spreadsheets");

// Our own config file
var scorecastConfig = require('./scorecast-config');


var scorecast = {

    scrapedMatches: {},
    dbMatches: null,
    groupsDone: 0,
    groupQueue: [],

    processWorksheet: function(worksheet, spreadsheetNum) {
        console.log('prosessing ' + spreadsheetNum + ' / ' + this.spreadsheetNumToGroup(spreadsheetNum));
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
            console.log("rebound, DB fetch not ready, groupname " + groupName);
            if (groupName) this.groupQueue.push(groupName);
            return;
        }

        // If groupName is not given, take the latest one from the queue
        groupName = groupName ? groupName : this.groupQueue.shift();

        if (!this.scrapedMatches[groupName]) {
            console.log("rebound " + groupName);
            if (groupName) this.groupQueue.push(groupName);
            return; 
        }
        
        // If we get here, we have DB results and scraped matches from this group
        console.log('----------------------------------');
        console.log(groupName + ' passed, continue.');
        this.groupsDone += 1;

        // Filter new matches
        var newMatches = _.filter(self.scrapedMatches[groupName], function(match) {
            var newMatch = true;
            _.each(self.dbMatches, function(dbMatch) {
                newmatch = false; // Found old match with same id - this is unwanted
            });
            return newMatch; // If we get here, this must be a new match
        });

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
                    console.log("New matches saved to the DB.");
                }
            });
        }
    },

    announceNewMatches: function(newMatches) {
        _.each(newMatches, function(newMatch) {

            // Form the HTML-formatted content information
            var title = 'Group ' + newMatch.group.charAt(0).toUpperCase() + ' - Match ' + newMatch.id;
            var content = '<p>' + 
                newMatch.homePlayer + ' (' + newMatch.homeTeam + ') vs ' + 
                newMatch.awayPlayer + ' (' + newMatch.awayTeam + ')</p> ';
            content = content + '<h1>' + newMatch.homeGoals + ' - ' + newMatch.awayGoals + '</h1>';
            var content = newMatch.overtime ? content + ' OT' : content;

            // Send them to Flowdock
            request({
                uri: scorecastConfig.flowdockUri,
                method: "POST",
                json: {
                    "source": "FHL Scorecast",
                    "from_address": scorecastConfig.senderEmail, 
                    "subject": title,
                    "content": content,
                    "tags":  ['groupstage', 'group-' + newMatch.group, 'game' + newMatch.id]
                }
            }, function(error, response, body) {
                console.log(body); // If this is empty, alles gut
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
        console.log("4 fetch start");
        spreadsheet.worksheets[4].cells({
            range: "R4C2:R16C13"
        }, 

        function(err, result) {
            console.log("4 fetched");
            scorecast.processWorksheet(result.cells, 4);
        });
    }
);

Spreadsheets(
    {
        key: scorecastConfig.spreadsheetKey
    },

    function(err, spreadsheet) {
        console.log("3 fetch start");
        spreadsheet.worksheets[3].cells({
            range: "R4C2:R16C13"
        }, 

        function(err, result) {
            console.log("3 fetched");
            scorecast.processWorksheet(result.cells, 3);
        });
    }
);

Spreadsheets(
    {
        key: scorecastConfig.spreadsheetKey
    },

    function(err, spreadsheet) {
        console.log("2 fetch start");
        spreadsheet.worksheets[2].cells({
            range: "R4C2:R16C13"
        }, 

        function(err, result) {
            console.log("2 fetched");
            scorecast.processWorksheet(result.cells, 2);
        });
    }
);


Spreadsheets(
    {
        key: scorecastConfig.spreadsheetKey
    },

    function(err, spreadsheet) {
        console.log("5 fetch start");
        spreadsheet.worksheets[5].cells({
            range: "R4C2:R16C13"
        }, 

        function(err, result) {
            console.log("5 fetched");
            scorecast.processWorksheet(result.cells, 5);
        });
    }
);


