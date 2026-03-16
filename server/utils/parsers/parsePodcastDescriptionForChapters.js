const Logger = require('../../Logger')

/**
 * Parse podcast descriptions for timestamps and generate chapters
 * The following formats are supports:
 *
 * MM:SS Chapter name
 * HH:MM:SS Chapter name
 * (HH:MM:SS) Chapter name
 *
 * Descriptions have to use <p>, <br> or \n to split up lines in order to be supported
 *
 * See test suite for more input examples
 *
 * @param {string} podcastDescription
 * @param {number} audioDurationSecs
 * @returns {ChapterObject[]}
 */
module.exports.parse = (podcastDescription, audioDurationSecs) => {
  if (podcastDescription == null) {
    throw new Error('Description must not be null')
  }

  if (audioDurationSecs == null) {
    throw new Error('Audio duration must not be null')
  }

  const timestampRegex = /\b(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\b/
  const chapterTitleRegex = /\b\d{1,2}:\d{1,2}(?::\d{1,2})?\b(?:\s+|\))(.+)$/
  const descriptionLineSplitRegex = /\<\s*\/\s*p\s*\>|\<\s*br\s*\s*\/\>|\n/

  var descriptionLines = podcastDescription.split(descriptionLineSplitRegex)
  var newChapters = []

  for (let i = 0; i < descriptionLines.length; i++) {
    let line = descriptionLines[i]

    let match = timestampRegex.exec(line)
    if (match == null) continue

    let first = match[1]
    let second = match[2]
    let third = match[3]

    let hours = 0
    let minutes = 0
    let seconds = 0

    // If there's three components then we can assume its hh:mm:ss
    if (first && second && third) {
      hours = Number(first)
      minutes = Number(second)
      seconds = Number(third)
    } else if (first && second) // otherwise assume mm:ss
    {
      minutes = Number(first)
      seconds = Number(second)
    }

    if (minutes > 59 || seconds > 59) {
      throw new Error(`Timestamp contains invalid minutes or seconds field '${minutes}::${seconds}'`)
    }

    let startTime = seconds + minutes * 60 + hours * 60 * 60
    if (startTime > audioDurationSecs) {
      throw new Error(`Chapter found that starts after over audio duration. Duration: ${audioDurationSecs}s - Chapter start ${startTime}s`)
    }

    let chapterTitleMatch = chapterTitleRegex.exec(line)

    if (chapterTitleMatch == null || chapterTitleMatch.length < 2) {
      // Unknown chapter state
      throw new Error(`Unable to get chapter title from description, line ${line}`)
    }

    let chapter = { title: chapterTitleMatch[1].trim(), id: newChapters.length + 1, start: startTime }

    if (newChapters.length > 0) {
      newChapters[newChapters.length - 1].end = startTime
    }

    newChapters.push(chapter)
  }
  if (newChapters.length > 0) {
    newChapters[newChapters.length - 1].end = audioDurationSecs
  }

  Logger.info(`[PodcastEpisode] Successfully generated ${newChapters.length} chapters`)

  if (newChapters.length == 1) {
    throw new Error('Only one chapter found, treating as invalid description')
  }

  return newChapters
}
