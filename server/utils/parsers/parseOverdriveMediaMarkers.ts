import { createRequire } from 'module'
import Logger from '../../Logger'

type MarkerXml = Record<string, { toString(): string }>
type OverdriveXml = {
  Markers?: {
    Marker?: MarkerXml[]
  }
}

const nodeRequire = createRequire(__filename)
const xml2js = nodeRequire('xml2js') as {
  parseString(xml: string, callback: (err: Error | null, result: OverdriveXml) => void): void
}

type ChapterMarker = {
  Name: string
  Time: string
}

type AbsChapter = {
  id: number
  start: number
  end?: number
  title: string
}

type AudioFileWithMarker = {
  duration: number
  metaTags: {
    tagOverdriveMediaMarker?: string | null
  }
}

// given the array of Overdrive Media Markers from generateOverdriveMediaMarkers()
//  parse and clean them in to something a bit more usable
function cleanOverdriveMediaMarkers(overdriveMediaMarkers: string[]): ChapterMarker[][] {
  Logger.debug('[parseOverdriveMediaMarkers] Cleaning up overdrive media markers')

  const parsedOverdriveMediaMarkers: ChapterMarker[][] = []
  overdriveMediaMarkers.forEach((item) => {
    let parsed_result: ChapterMarker[] | null = null
    // convert xml to JSON
    xml2js.parseString(item, function (err, result) {
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
function objectValuesArrayToString(arrayOfObjects: Array<Record<string, { toString(): string }>>): ChapterMarker[] {
  Logger.debug('[parseOverdriveMediaMarkers] Converting Marker object values from arrays to strings')
  arrayOfObjects.forEach((item) => {
    Object.keys(item).forEach((key) => {
      item[key] = item[key].toString()
    })
  })

  return arrayOfObjects as ChapterMarker[]
}

// Overdrive sometimes has weird chapters and subchapters defined
//  These aren't necessary, so lets remove them
function removeExtraChapters(parsedOverdriveMediaMarkers: ChapterMarker[][]): ChapterMarker[][] {
  Logger.debug('[parseOverdriveMediaMarkers] Removing any unnecessary chapters')
  const weirdChapterFilterRegex = /([(]\d|[cC]ontinued)/
  const cleaned: ChapterMarker[][] = []
  parsedOverdriveMediaMarkers.forEach(function (item) {
    cleaned.push(item.filter((chapter) => !weirdChapterFilterRegex.test(chapter.Name)))
  })

  return cleaned
}

// Given a set of chapters from generateParsedChapters, add the end time to each one
function addChapterEndTimes(chapters: AbsChapter[], totalAudioDuration: number): AbsChapter[] {
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
function generateParsedChapters(includedAudioFiles: AudioFileWithMarker[], cleanedOverdriveMediaMarkers: ChapterMarker[][]): AbsChapter[] {
  Logger.debug('[parseOverdriveMediaMarkers] Generating new chapters for ABS')
  // logic ported over from benonymity's OverdriveChapterizer:
  //    https://github.com/benonymity/OverdriveChapterizer/blob/main/chapters.py
  let parsedChapters: AbsChapter[] = []
  let length = 0.0
  let index = 0
  let time = 0.0

  // cleanedOverdriveMediaMarkers is an array of array of objects, where the inner array matches to the included audio files tracks
  //     this allows us to leverage the individual track durations when calculating the start times of chapters in tracks after the first (using length)
  // TODO: can we guarantee the inner array matches the included audio files?
  includedAudioFiles.forEach((track, track_index) => {
    cleanedOverdriveMediaMarkers[track_index].forEach((chapter) => {
      const timeParts = chapter.Time.split(':')
      // add seconds
      time = length + parseFloat(timeParts.pop() as string)
      if (timeParts.length) {
        // add minutes
        time += parseFloat(timeParts.pop() as string) * 60
      }
      if (timeParts.length) {
        // add hours
        time += parseFloat(timeParts.pop() as string) * 3600
      }
      const newChapterData = {
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

export function parseOverdriveMediaMarkersAsChapters(includedAudioFiles: AudioFileWithMarker[]): AbsChapter[] | null {
  const overdriveMediaMarkers = includedAudioFiles.map((af) => af.metaTags.tagOverdriveMediaMarker).filter((af): af is string => Boolean(af)) || []
  if (!overdriveMediaMarkers.length) return null

  const cleanedOverdriveMediaMarkers = cleanOverdriveMediaMarkers(overdriveMediaMarkers)
  // TODO: generateParsedChapters requires overdrive media markers and included audio files length to be the same
  //         so if not equal then we must exit
  if (cleanedOverdriveMediaMarkers.length !== includedAudioFiles.length) return null
  return generateParsedChapters(includedAudioFiles, cleanedOverdriveMediaMarkers)
}
