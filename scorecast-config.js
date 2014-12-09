// ### Key to the Google Spreadsheet
// Can be found as a part of the URL found on spreadsheet's File -> Publish to web... dialog
exports.spreadsheetShareUrl = '';

// ### Flowdock Team Inbox API URL
// Read more at https://www.flowdock.com/api/team-inbox
exports.flowdockUrl = 'https://api.flowdock.com/v1/messages/team_inbox/<flowApiKey>';

// ### Sender Info 
// this shows on Flowdock inbox as the sender
exports.senderEmail = 'john@doe.com';
exports.senderTitle = 'Futurice Scorecast';

// ### Link to the Spreadsheet
// This is shown on the Flowdoge messages
exports.spreadsheetLink = '';

// ### MongoDB config
exports.database = {
    address: 'localhost',
    name: 'scorecast',
    port: 27017
};

// ### Config for each worksheet that will be scraped for matches
// From each sheet a "rectangle" of cells will be fetched. You have to provide the 
// limiting columns & rows of this rectangle. The borders are inclusive. 
//
// All the indexing starts from 0, so first sheet/row/column's index is 0, NOT 1

var groupStageConfig = {
        leftBorder: 2,
        rightBorder: 13,
        topBorder: 4,
        bottomBorder: 43,

        sheetGroupType: 'group stage' 
};

// Object that holds the column numbers for specific data types on each match rows
// This must be modified to match your sheet type. This information will be saved
// to the database
// TODO: playoff sheet is different than this
var matchDataCols = {
    id: 2,
    date: 3,
    
    homeTeam: 4,
    homePlayer: 5,
    homeGoals: 6,
    // 7 = row delimiter on our template
    awayGoals: 8,
    awayPlayer: 9,
    awayTeam: 10,

    overtime: 11,

    homePoints: 12,
    awayPoints: 13
};

exports.worksheets = [
 
    // {
    //  sheetGroupType: string that will be used to group different kind of sheets. For example "groupstage" or "playoffs"
    //  sheetGroupName: string to indicate a readable name for this sheet's group. For example "Group A" or "Playoffs"
    //  sheetIndex: order number of this worksheet
    //
    //  leftBorder: the leftmost column on the content square
    //  rightBorder: the right-most column on the content square
    //  topBorder: the top row for the content square
    //  bottomBorder: the bottom row for the content square
    //  
    //  homePointsCol: index of the column for home team's points on the content square. Indexing is the same as on the full spreadsheet
    //  awayPointsCol: -||-
    // }

    {
        sheetGroupName: 'Group A',
        sheetIndex: 2,
        dataCols: matchDataCols,

        leftBorder: groupStageConfig.leftBorder,
        rightBorder: groupStageConfig.rightBorder,
        topBorder: groupStageConfig.topBorder,
        bottomBorder: groupStageConfig.bottomBorder,

        homePointsCol: groupStageConfig.homePointsCol,
        awayPointsCol: groupStageConfig.awayPointsCol,

        sheetGroupType: groupStageConfig.sheetGroupType
    },

    {
        sheetGroupName: 'Group B',
        sheetIndex: 3,
        dataCols: matchDataCols,

        leftBorder: groupStageConfig.leftBorder,
        rightBorder: groupStageConfig.rightBorder,
        topBorder: groupStageConfig.topBorder,
        bottomBorder: groupStageConfig.bottomBorder,

        homePointsCol: groupStageConfig.homePointsCol,
        awayPointsCol: groupStageConfig.awayPointsCol,

        sheetGroupType: groupStageConfig.sheetGroupType
    },

    {
        sheetGroupName: 'Group C',
        sheetIndex: 4,
        dataCols: matchDataCols,

        leftBorder: groupStageConfig.leftBorder,
        rightBorder: groupStageConfig.rightBorder,
        topBorder: groupStageConfig.topBorder,
        bottomBorder: groupStageConfig.bottomBorder,

        homePointsCol: groupStageConfig.homePointsCol,
        awayPointsCol: groupStageConfig.awayPointsCol,

        sheetGroupType: groupStageConfig.sheetGroupType
    },

    {
        sheetGroupName: 'Group D',
        sheetIndex: 5,
        dataCols: matchDataCols,

        leftBorder: groupStageConfig.leftBorder,
        rightBorder: groupStageConfig.rightBorder,
        topBorder: groupStageConfig.topBorder,
        bottomBorder: groupStageConfig.bottomBorder,

        homePointsCol: groupStageConfig.homePointsCol,
        awayPointsCol: groupStageConfig.awayPointsCol,

        sheetGroupType: groupStageConfig.sheetGroupType
    },

    {
        sheetGroupName: 'Playoffs',
        sheetIndex: 6,
        dataCols: matchDataCols,

        leftBorder: 0,
        rightBorder: 11,
        topBorder: 3,
        bottomBorder: 33,

        homePointsCol: 10,
        awayPointsCol: 11,

        sheetGroupType: 'playoffs'
    }
];


};
