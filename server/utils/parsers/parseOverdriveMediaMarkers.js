const Logger = require('../../Logger')

// given a list of audio files, extract all of the Overdrive Media Markers metaTags, and return an array of them as XML
function extractOverdriveMediaMarkers(includedAudioFiles) {
  Logger.debug('[parseOverdriveMediaMarkers] Extracting overdrive media markers')
  var markers = includedAudioFiles.map((af) => af.metaTags.tagOverdriveMediaMarker).filter(notUndefined => notUndefined !== undefined).filter(elem => { return elem !== null }) || []

  return markers
}

// given the array of Overdrive Media Markers from generateOverdriveMediaMarkers()
//  parse and clean them in to something a bit more usable
function cleanOverdriveMediaMarkers(overdriveMediaMarkers) {
  Logger.debug('[parseOverdriveMediaMarkers] Cleaning up overdrive media markers')
  /*
  returns an array of arrays of objects. Each inner array corresponds to an audio track, with it's objects being a chapter:
  [
    [
     {
      "Name": "Chapter 1",
      "Time": "0:00.000"
    },
    {
      "Name": "Chapter 2",
      "Time": "15:51.000"
    },
    { etc }
    ]
  ]
  */

  var parseString = require('xml2js').parseString; // function to convert xml to JSON
  var parsedOverdriveMediaMarkers = []

  overdriveMediaMarkers.forEach(function (item, index) {
    var parsed_result
    parseString(item, function (err, result) {
      /*
      result.Markers.Marker is the result of parsing the XML for the MediaMarker tags for the MP3 file (Part##.mp3)
      it is shaped like this, and needs further cleaning below:
      [
        {
          "Name": [
              "Chapter 1:  "
          ],
          "Time": [
              "0:00.000"
          ]
        },
        {
          ANOTHER CHAPTER
        },
      ]
      */

      // The values for Name and Time in results.Markers.Marker are returned as Arrays from parseString and should be strings
      parsed_result = objectValuesArrayToString(result.Markers.Marker)
    })

    parsedOverdriveMediaMarkers.push(parsed_result)
  })

  return removeExtraChapters(parsedOverdriveMediaMarkers)
}

// given an array of objects, convert any values that are arrays to strings
function objectValuesArrayToString(arrayOfObjects) {
  Logger.debug('[parseOverdriveMediaMarkers] Converting Marker object values from arrays to strings')
  arrayOfObjects.forEach((item) => {
    Object.keys(item).forEach(key => {
      item[key] = item[key].toString()
    })
  })

  return arrayOfObjects
}

// Overdrive sometimes has weird chapters and subchapters defined
//  These aren't necessary, so lets remove them
function removeExtraChapters(parsedOverdriveMediaMarkers) {
  Logger.debug('[parseOverdriveMediaMarkers] Removing any unnecessary chapters')
  const weirdChapterFilterRegex = /([(]\d|[cC]ontinued)/
  var cleaned = []
  parsedOverdriveMediaMarkers.forEach(function (item) {
    cleaned.push(item.filter(chapter => !weirdChapterFilterRegex.test(chapter.Name)))
  })

  return cleaned
}

// Given a set of chapters from generateParsedChapters, add the end time to each one
function addChapterEndTimes(chapters, totalAudioDuration) {
  Logger.debug('[parseOverdriveMediaMarkers] Adding chapter end times')
  chapters.forEach((chapter, chapter_index) => {
    if (chapter_index < chapters.length - 1) {
      chapter.end = chapters[chapter_index + 1].start
    } else {
      chapter.end = totalAudioDuration
    }
  })

  return chapters
}

// The function that actually generates the Chapters object that we update ABS with
function generateParsedChapters(includedAudioFiles, cleanedOverdriveMediaMarkers) {
  Logger.debug('[parseOverdriveMediaMarkers] Generating new chapters for ABS')
  // logic ported over from benonymity's OverdriveChapterizer:
  //    https://github.com/benonymity/OverdriveChapterizer/blob/main/chapters.py
  var parsedChapters = []
  var length = 0.0
  var index = 0
  var time = 0.0

  // cleanedOverdriveMediaMarkers is an array of array of objects, where the inner array matches to the included audio files tracks
  //     this allows us to leverage the individual track durations when calculating the start times of chapters in tracks after the first (using length)
  includedAudioFiles.forEach((track, track_index) => {
    cleanedOverdriveMediaMarkers[track_index].forEach((chapter) => {
      time = chapter.Time.split(":")
      time = length + parseFloat(time[0]) * 60 + parseFloat(time[1])
      var newChapterData = {
        id: index++,
        start: time,
        title: chapter.Name
      }
      parsedChapters.push(newChapterData)
    })
    length += track.duration
  })

  parsedChapters = addChapterEndTimes(parsedChapters, length) // we need all the start times sorted out before we can add the end times

  return parsedChapters
}

module.exports.overdriveMediaMarkersExist = (includedAudioFiles) => {
  return extractOverdriveMediaMarkers(includedAudioFiles).length > 1
}

module.exports.parseOverdriveMediaMarkersAsChapters = (includedAudioFiles) => {
  Logger.info('[parseOverdriveMediaMarkers] Parsing of Overdrive Media Markers started')

  var overdriveMediaMarkers = extractOverdriveMediaMarkers(includedAudioFiles)
  var cleanedOverdriveMediaMarkers = cleanOverdriveMediaMarkers(overdriveMediaMarkers)
  var parsedChapters = generateParsedChapters(includedAudioFiles, cleanedOverdriveMediaMarkers)

  return parsedChapters
}