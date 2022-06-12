const Logger = require('../../Logger')

// given a list of audio files, extract all of the Overdrive Media Markers metaTags, and return an array of them as XML
function overdriveMediaMarkers(includedAudioFiles) {
    var markers = includedAudioFiles.map((af) => af.metaTags.tagOverdriveMediaMarker).filter(notUndefined => notUndefined !== undefined).filter(elem => { return elem !== null }) || []
    return markers
}

// given the array of Overdrive Media Markers from generateOverdriveMediaMarkers()
//  parse and clean them in to something a bit more usable
function cleanOverdriveMediaMarkers(overdriveMediaMarkers) {
    var parseString = require('xml2js').parseString; // function to convert xml to JSON
    var parsedOverdriveMediaMarkers = []

    // go from an array of arrays of objects to an array of objects
    // end result looks like:
    // [
    //   {
    //     "Name": "Chapter 1",
    //     "Time": "0:00.000"
    //   },
    //   {
    //     "Name": "Chapter 2",
    //     "Time": "15:51.000"
    //   },
    //   { redacted }
    // ]
    overdriveMediaMarkers.forEach(function (item, index) {
        var parsed_result
        parseString(item, function (err, result) {
            // result.Markers.Marker is the result of parsing the XML for the MediaMarker tags for the MP3 file (Part##.mp3)
            // it is shaped like this:
            // [
            //   {
            //     "Name": [
            //       "Chapter 1:  "
            //     ],
            //     "Time": [
            //       "0:00.000"
            //     ]
            //   },
            //   {
            //     "Name": [
            //       "Chapter 2: "
            //     ],
            //     "Time": [
            //       "15:51.000"
            //     ]
            //   }
            // ]

            parsed_result = result.Markers.Marker

            // The values for Name and Time in parsed_results are returned as Arrays from parseString
            // update them to be strings
            parsed_result.forEach((item, index) => {
                Object.keys(item).forEach(key => {
                    item[key] = item[key].toString()
                })
            })
        })

        parsedOverdriveMediaMarkers.push(parsed_result)
    })

    return parsedOverdriveMediaMarkers
}

// The function that actually generates the Chapters object that we update ABS with
function generateParsedChapters(includedAudioFiles, cleanedOverdriveMediaMarkers) {
    // actually generate the chapter object
    // logic ported over from benonymity's OverdriveChapterizer:
    //    https://github.com/benonymity/OverdriveChapterizer/blob/main/chapters.py
    var length = 0.0
    var index = 0
    var time = 0.0
    var newChapters = []
    const weirdChapterFilterRegex = /([(]\d|[cC]ontinued)/
    includedAudioFiles.forEach((track, track_index) => {
        cleanedOverdriveMediaMarkers[track_index].forEach((chapter) => {
            Logger.debug(`[parseOverdriveMediaMarkers] Attempting regex check for ${chapter.Name}...`)
            if (weirdChapterFilterRegex.test(chapter.Name)) {
                Logger.debug(`[parseOverdriveMediaMarkers] Regex matched. Skipping ${chapter.Name}!`)
                return
            }
            time = chapter.Time.split(":")
            time = length + parseFloat(time[0]) * 60 + parseFloat(time[1])
            newChapters.push(
                {
                    id: index++,
                    start: time,
                    end: length,
                    title: chapter.Name
                }
            )
        })
        length += track.duration
    })

    return newChapters
}

module.exports.overdriveMediaMarkersExist = (includedAudioFiles) => {
    return overdriveMediaMarkers(includedAudioFiles).length > 1
}

module.exports.parseOverdriveMediaMarkersAsChapters = (includedAudioFiles) => {
    Logger.info('[parseOverdriveMediaMarkers] Parsing of Overdrive Media Markers started')
    var cleanedOverdriveMediaMarkers = cleanOverdriveMediaMarkers(overdriveMediaMarkers(includedAudioFiles))
    var parsedChapters = generateParsedChapters(includedAudioFiles, cleanedOverdriveMediaMarkers)
    
    return parsedChapters
}
