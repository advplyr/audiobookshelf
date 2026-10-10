import { AudioMimeType } from '../../utils/constants'
import AudioMetaTags from '../metadata/AudioMetaTags'
import FileMetadata from '../metadata/FileMetadata'

type FileMetadataJSON = ReturnType<FileMetadata['toJSON']>
type AudioMetaTagsJSON = ReturnType<AudioMetaTags['toJSON']>

interface AudioFileChapter {
  id: number
  start: number
  end: number
  title: string
}

interface AudioFileData {
  index: number | null | undefined
  ino: string | null | undefined
  metadata: FileMetadataJSON
  addedAt: number | null | undefined
  updatedAt: number | null | undefined
  trackNumFromMeta: number | null | undefined
  discNumFromMeta: number | null | undefined
  trackNumFromFilename: number | null | undefined
  discNumFromFilename: number | null | undefined
  manuallyVerified: boolean
  exclude: boolean
  error: string | null
  format: string | null | undefined
  duration: number | null | undefined
  bitRate: number | null | undefined
  language: string | null | undefined
  codec: string | null
  timeBase: string | null | undefined
  channels: number | null | undefined
  channelLayout: string | null | undefined
  chapters: AudioFileChapter[] | undefined
  embeddedCoverArt: string | null | undefined
  /** Only the tags that are set */
  metaTags: AudioMetaTagsJSON
  mimeType: string
}

/** Persisted audio file json. `cdNumFromFilename` is the old name of `discNumFromFilename` */
type AudioFileConstructData = Partial<Omit<AudioFileData, 'mimeType'>> & { cdNumFromFilename?: number | null }

/** Data from MediaProbeData */
interface AudioFileProbeData {
  format: string | null | undefined
  duration: number | null | undefined
  bitRate?: number | null
  language: string | null | undefined
  codec?: string | null
  timeBase: string | null | undefined
  channels: number | null | undefined
  channelLayout: string | null | undefined
  chapters?: AudioFileChapter[] | null
  audioMetaTags: AudioMetaTags | null
  embeddedCoverArt: string | null | undefined
}

/** A library file being turned into an audio file */
interface AudioFileSource {
  ino?: string | null
  metadata: FileMetadata | FileMetadataJSON
}

class AudioFile {
  [key: string]: unknown
  index: number | null | undefined = null
  ino: string | null | undefined = null
  metadata: FileMetadata | null = null
  addedAt: number | null | undefined = null
  updatedAt: number | null | undefined = null

  trackNumFromMeta: number | null | undefined = null
  discNumFromMeta: number | null | undefined = null
  trackNumFromFilename: number | null | undefined = null
  discNumFromFilename: number | null | undefined = null

  format: string | null | undefined = null
  duration: number | null | undefined = null
  bitRate: number | null | undefined = null
  language: string | null | undefined = null
  codec: string | null = null
  timeBase: string | null | undefined = null
  channels: number | null | undefined = null
  channelLayout: string | null | undefined = null
  chapters: AudioFileChapter[] | undefined = []
  embeddedCoverArt: string | null | undefined = null

  /** Tags scraped from the audio file */
  metaTags: AudioMetaTags | null = null

  manuallyVerified = false
  exclude = false
  error: string | null = null

  constructor(data?: AudioFileConstructData | null) {
    if (data) {
      this.construct(data)
    }
  }

  // Requires initialized metadata, as in the original JavaScript implementation.
  toJSON(): AudioFileData {
    return {
      index: this.index,
      ino: this.ino,
      metadata: this.metadata!.toJSON(),
      addedAt: this.addedAt,
      updatedAt: this.updatedAt,
      trackNumFromMeta: this.trackNumFromMeta,
      discNumFromMeta: this.discNumFromMeta,
      trackNumFromFilename: this.trackNumFromFilename,
      discNumFromFilename: this.discNumFromFilename,
      manuallyVerified: !!this.manuallyVerified,
      exclude: !!this.exclude,
      error: this.error || null,
      format: this.format,
      duration: this.duration,
      bitRate: this.bitRate,
      language: this.language,
      codec: this.codec,
      timeBase: this.timeBase,
      channels: this.channels,
      channelLayout: this.channelLayout,
      chapters: this.chapters,
      embeddedCoverArt: this.embeddedCoverArt,
      metaTags: this.metaTags?.toJSON() || {},
      mimeType: this.mimeType
    }
  }

  construct(data: AudioFileConstructData) {
    this.index = data.index
    this.ino = data.ino
    this.metadata = new FileMetadata(data.metadata || {})
    this.addedAt = data.addedAt
    this.updatedAt = data.updatedAt
    this.manuallyVerified = !!data.manuallyVerified
    this.exclude = !!data.exclude
    this.error = data.error || null

    this.trackNumFromMeta = data.trackNumFromMeta
    this.discNumFromMeta = data.discNumFromMeta
    this.trackNumFromFilename = data.trackNumFromFilename

    if (data.cdNumFromFilename !== undefined) this.discNumFromFilename = data.cdNumFromFilename // TEMP:Support old var name
    else this.discNumFromFilename = data.discNumFromFilename

    this.format = data.format
    this.duration = data.duration
    this.bitRate = data.bitRate
    this.language = data.language
    this.codec = data.codec || null
    this.timeBase = data.timeBase
    this.channels = data.channels
    this.channelLayout = data.channelLayout
    this.chapters = data.chapters
    this.embeddedCoverArt = data.embeddedCoverArt || null

    this.metaTags = new AudioMetaTags(data.metaTags || {})
  }

  get mimeType(): string {
    const format = this.metadata!.format.toUpperCase()
    const mimeTypes: Partial<Record<string, string>> = AudioMimeType
    const mimeType = mimeTypes[format]
    if (mimeType) {
      return mimeType
    } else {
      return AudioMimeType.MP3
    }
  }

  /** New scanner creates AudioFile from AudioFileScanner */
  setDataFromProbe(libraryFile: AudioFileSource, probeData: AudioFileProbeData) {
    this.ino = libraryFile.ino || null

    if (libraryFile.metadata instanceof FileMetadata) {
      this.metadata = libraryFile.metadata.clone()
    } else {
      this.metadata = new FileMetadata(libraryFile.metadata)
    }

    this.addedAt = Date.now()
    this.updatedAt = Date.now()

    this.format = probeData.format
    this.duration = probeData.duration
    this.bitRate = probeData.bitRate || null
    this.language = probeData.language
    this.codec = probeData.codec || null
    this.timeBase = probeData.timeBase
    this.channels = probeData.channels
    this.channelLayout = probeData.channelLayout
    this.chapters = probeData.chapters || []
    this.metaTags = probeData.audioMetaTags
    this.embeddedCoverArt = probeData.embeddedCoverArt
  }

  /**
   * Requires initialized chapters, matching the original failure on incomplete persisted data.
   * @returns true if the chapters changed
   */
  syncChapters(updatedChapters: AudioFileChapter[]): boolean {
    if (this.chapters!.length !== updatedChapters.length) {
      this.chapters = updatedChapters.map((ch) => ({ ...ch }))
      return true
    } else if (updatedChapters.length === 0) {
      if (this.chapters!.length > 0) {
        this.chapters = []
        return true
      }
      return false
    }

    let hasUpdates = false
    for (let i = 0; i < updatedChapters.length; i++) {
      if (JSON.stringify(updatedChapters[i]) !== JSON.stringify(this.chapters![i])) {
        hasUpdates = true
      }
    }
    if (hasUpdates) {
      this.chapters = updatedChapters.map((ch) => ({ ...ch }))
    }
    return hasUpdates
  }

  clone(): AudioFile {
    return new AudioFile(this.toJSON())
  }

  /**
   * @returns true if updates were made
   */
  updateFromScan(scannedAudioFile: AudioFile): boolean {
    let hasUpdated = false

    const newjson = scannedAudioFile.toJSON()
    const ignoreKeys = ['manuallyVerified', 'ctimeMs', 'addedAt', 'updatedAt']

    // Keys of the json are copied by name onto this audio file

    for (const key in newjson) {
      const scannedValue: unknown = Reflect.get(newjson, key)
      if (key === 'metadata') {
        if (this.metadata!.update(newjson.metadata)) {
          hasUpdated = true
        }
      } else if (key === 'metaTags') {
        if (!this.metaTags || !this.metaTags.isEqual(scannedAudioFile.metaTags)) {
          this.metaTags = scannedAudioFile.metaTags!.clone()
          hasUpdated = true
        }
      } else if (key === 'chapters') {
        if (this.syncChapters(newjson.chapters || [])) {
          hasUpdated = true
        }
      } else if (!ignoreKeys.includes(key) && this[key] !== scannedValue) {
        this[key] = scannedValue
        hasUpdated = true
      }
    }
    return hasUpdated
  }
}

export = AudioFile
