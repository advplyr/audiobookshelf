// Generate blank audiobooks for running tests

const fs = require('fs');
const path = require('path');
const Ffmpeg = require("./server/libs/fluentFfmpeg")
const toneHelpers = require("./server/utils/toneHelpers")
const booksMetadata = require("./cypress/fixtures/bookMetadata/index")
const BookMetadata = require("./server/objects/metadata/BookMetadata")

const processLibraryItem = async (libraryItem) => {
  const filename = path.join('./cypress/fixtures/audiobooks', libraryItem.relPath, libraryItem.media.audioFiles[0].metadata.filename)

  // Make a directory
  if (fs.existsSync(path.dirname(filename)))
    fs.rmSync(path.dirname(filename), { recursive: true });
  fs.mkdirSync(path.dirname(filename), { recursive: true });

  const toneJsonPath = path.join('./cypress/fixtures/audiobooks', libraryItem.relPath, 'tone-data.json')
  const toneJsonObject = { 'ToneJsonFile': toneJsonPath, 'TrackNumber': 1 }

  libraryItem.media.metadata = new BookMetadata(libraryItem.media.metadata)
  await toneHelpers.writeToneMetadataJsonFile(libraryItem, libraryItem.media.chapters, toneJsonPath, 1, libraryItem.media.audioFiles[0].mimetype)

  return new Promise((resolve, reject) => {
    Ffmpeg()
      .input('anullsrc')
      .inputFormat('lavfi')
      .duration(60)
      .save(filename)
      .on('end', function () {

        console.log('Generated testing file for processing');
        toneHelpers.tagAudioFile(filename, toneJsonObject).then(function () {
          fs.rmSync(toneJsonPath)
          resolve();
        })
      })
  });
}

const processItems = async () => {
  for (let libraryItem of booksMetadata) {
    await processLibraryItem(libraryItem);
  }
}

processItems();