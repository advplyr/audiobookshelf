const Logger = require('../../Logger')

// given an array of audioFiles, return an array of unparsed MediaMarkers
module.exports.getOverdriveMediaMarkersFromFiles = (audioFiles) => {
    var markers = audioFiles.map((af) => af.metaTags.tagOverdriveMediaMarker).filter(notUndefined => notUndefined !== undefined).filter(elem => { return elem !== null }) || [] 
    return markers
}

module.exports.parseOverdriveMediaMarkers = (overdriveMediaMarkers, includedAudioFiles) => {
    var parseString = require('xml2js').parseString; // function to convert xml to JSON
    
    var parsedOverdriveMediaMarkers = [] // an array of objects. each object being a chapter with a name and time key. the values are arrays of strings

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

    // go from an array of arrays of objects to an array of objects
    // end result looks like:
    // [
    //   {
    //     "Name": "Chapter 1:  The Worst Birthday",
    //     "Time": "0:00.000"
    //   },
    //   {
    //     "Name": "Chapter 2:  Dobby's Warning",
    //     "Time": "15:51.000"
    //   },
    //   { redacted }
    // ]
    parsedOverdriveMediaMarkers = parsedOverdriveMediaMarkers

    var index = 0
    
    var time = 0.0
    

    // actually generate the chapter object
    // logic ported over from benonymity's OverdriveChapterizer:
    //    https://github.com/benonymity/OverdriveChapterizer/blob/main/chapters.py
    var length = 0.0
    var newOChapters = []
    const weirdChapterFilterRegex = /([(]\d|[cC]ontinued)/
    includedAudioFiles.forEach((track, track_index) => {
      parsedOverdriveMediaMarkers[track_index].forEach((chapter) => {
        Logger.debug(`[parseOverdriveMediaMarkers] Attempting regex check for ${chapter.Name}!`)
        if (weirdChapterFilterRegex.test(chapter.Name)) {
          Logger.debug(`[parseOverdriveMediaMarkers] That shit weird yo`)
          return
        }
        time = chapter.Time.split(":")
        time = length + parseFloat(time[0]) * 60 + parseFloat(time[1])
        newOChapters.push(
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

    Logger.debug(`[parseOverdriveMediaMarkers] newOChapters: ${JSON.stringify(newOChapters)}`)
    return newOChapters
}