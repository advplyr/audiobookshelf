const LibraryFile = require('../../../server/objects/files/LibraryFile')
const EBookFile = require('../../../server/objects/files/EBookFile')
const AudioFile = require('../../../server/objects/files/AudioFile')
const LibraryItem = require('../../../server/models/LibraryItem')
const LibraryItemScanData = require('../../../server/scanner/LibraryItemScanData')

// TODO: all of these duplicate each other. Need to verify that deviceId is set on each when constructing. And that deviceId is populated when using toJSON()

// TODO: check that any libraryFiles properties set to JSON contain a LibraryFile which has a deviceId property
