const xml2js = require('xml2js')
const Logger = require('../../Logger')

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

  const parsedOverdriveMediaMarkers = []
  overdriveMediaMarkers.forEach((item, index) => {
    let parsed_result = null
    // convert xml to JSON
    xml2js.parseString(item, function (err, result) {
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
      if (result?.Markers?.Marker) {
        parsed_result = objectValuesArrayToString(result.Markers.Marker)
      }
    })

    if (parsed_result) {
      parsedOverdriveMediaMarkers.push(parsed_result)
    }
  })

  return removeExtraChapters(parsedOverdriveMediaMarkers)
}

// given an array of objects, convert any values that are arrays to strings
function objectValuesArrayToString(arrayOfObjects) {
  Logger.debug('[parseOverdriveMediaMarkers] Converting Marker object values from arrays to strings')
  arrayOfObjects.forEach((item) => {
    Object.keys(item).forEach((key) => {
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
    cleaned.push(item.filter((chapter) => !weirdChapterFilterRegex.test(chapter.Name)))
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
  // TODO: can we guarantee the inner array matches the included audio files?
  includedAudioFiles.forEach((track, track_index) => {
    cleanedOverdriveMediaMarkers[track_index].forEach((chapter) => {
      let timeParts = chapter.Time.split(':')
      // add seconds
      time = length + parseFloat(timeParts.pop())
      if (timeParts.length) {
        // add minutes
        time += parseFloat(timeParts.pop()) * 60
      }
      if (timeParts.length) {
        // add hours
        time += parseFloat(timeParts.pop()) * 3600
      }
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

module.exports.parseOverdriveMediaMarkersAsChapters = (includedAudioFiles) => {
  const overdriveMediaMarkers = includedAudioFiles.map((af) => af.metaTags.tagOverdriveMediaMarker).filter((af) => af) || []
  if (!overdriveMediaMarkers.length) return null

  var cleanedOverdriveMediaMarkers = cleanOverdriveMediaMarkers(overdriveMediaMarkers)
  // TODO: generateParsedChapters requires overdrive media markers and included audio files length to be the same
  //         so if not equal then we must exit
  if (cleanedOverdriveMediaMarkers.length !== includedAudioFiles.length) return null
  return generateParsedChapters(includedAudioFiles, cleanedOverdriveMediaMarkers)
}
