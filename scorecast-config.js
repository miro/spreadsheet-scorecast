// ### Key to the Google Spreadsheet
// Can be found as a part of the URL found on spreadsheet's File -> Publish to web... dialog
exports.spreadsheetKey = '';

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


// ### Config for each worksheet that will be scraped for matches
// From each sheet a "rectangle" of cells will be fetched. You have to provide the 
// limiting columns & rows of this rectangle. The borders are inclusive. 
//
// All the indexing starts from 0, so first sheet/row/column's index is 0, NOT 1
exports.worksheets = [

    // {
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
];


};

