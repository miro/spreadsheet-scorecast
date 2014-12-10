spreadsheet-scorecast
=============

Script for scraping matches from Google Spreadsheet and then announcing them to Flowdock's Team Inbox.

This is a short nodejs-program that crawls through Google Spreadsheet, finds new matches, and then posts the score of the new matches to Flowdock Team Inbox before restoring the matches to MongoDB.

See the [example spreadsheet](http://bit.ly/1fzyql7) which is in format that this app expects.
