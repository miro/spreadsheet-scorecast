// ### Key to the Google Spreadsheet
// Can be found as a part of the URL found on spreadsheet's File -> Publish to web... dialog
exports.spreadsheetKey = '';

// ### Flowdock API Key
// Read more at https://www.flowdock.com/api/team-inbox
exports.flowdockApiKey = '';

// ### Sender Info 
// this shows on Flowdock inbox as the sender
exports.senderEmail = 'fhl@futurice.com';
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



// Object that holds the column numbers for specific data types on each match rows
// This must be modified to match your sheet type. This information will be saved
// to the database
// TODO: playoff sheet on FCL is different than this, do something
// TODO: there is something funny on how the index of cols is calculated. Find out what.
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


var groupStageConfig = {
    area: {
        leftBorder: 2,
        rightBorder: 13,
        topBorder: 4,
        bottomBorder: 43
    },

    sheetGroupType: 'group stage' 
};

exports.worksheets = [
 
    // {
    //  sheetGroupType: string that will be used to group different kind of sheets. For example "groupstage" or "playoffs"
    //  sheetGroupName: string to indicate a readable name for this sheet's group. For example "Group A" or "Playoffs"
    //  sheetIndex: order number of this worksheet
    //
    //  area.leftBorder: the leftmost column on the content square
    //  area.rightBorder: the right-most column on the content square
    //  area.topBorder: the top row for the content square
    //  area.bottomBorder: the bottom row for the content square
    //  
    // }

    {
        sheetGroupName: 'Group A',
        sheetIndex: 2,
        dataCols: matchDataCols,

        area: groupStageConfig.area,

        sheetGroupType: groupStageConfig.sheetGroupType
    },

    {
        sheetGroupName: 'Group B',
        sheetIndex: 3,
        dataCols: matchDataCols,

        area: groupStageConfig.area,

        sheetGroupType: groupStageConfig.sheetGroupType
    },

    {
        sheetGroupName: 'Group C',
        sheetIndex: 4,
        dataCols: matchDataCols,

        area: groupStageConfig.area,

        sheetGroupType: groupStageConfig.sheetGroupType
    },

    {
        sheetGroupName: 'Group D',
        sheetIndex: 5,
        dataCols: matchDataCols,

        area: groupStageConfig.area,

        sheetGroupType: groupStageConfig.sheetGroupType
    }

    // TODO: Playoff sheet config
];
