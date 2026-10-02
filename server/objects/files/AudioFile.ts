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
  index: number | null
  ino: string | null
  metadata: FileMetadataJSON
  addedAt: number | null
  updatedAt: number | null
  trackNumFromMeta: number | null
  discNumFromMeta: number | null
  trackNumFromFilename: number | null
  discNumFromFilename: number | null
  manuallyVerified: boolean
  exclude: boolean
  error: string | null
  format: string | null
  duration: number | null
  bitRate: number | null
  language: string | null
  codec: string | null
  timeBase: string | null
  channels: number | null
  channelLayout: string | null
  chapters: AudioFileChapter[]
  embeddedCoverArt: string | null
  /** Only the tags that are set */
  metaTags: AudioMetaTagsJSON
  mimeType: string
}

/** Persisted audio file json. `cdNumFromFilename` is the old name of `discNumFromFilename` */
type AudioFileConstructData = Partial<Omit<AudioFileData, 'mimeType'>> & { cdNumFromFilename?: number | null }

/** Data from MediaProbeData */
interface AudioFileProbeData {
  format: string | null
  duration: number | null
  bitRate?: number | null
  language: string | null
  codec?: string | null
  timeBase: string | null
  channels: number | null
  channelLayout: string | null
  chapters?: AudioFileChapter[] | null
  audioMetaTags: AudioMetaTags | null
  embeddedCoverArt: string | null
}

/** A library file being turned into an audio file */
interface AudioFileSource {
  ino?: string | null
  metadata: FileMetadata | FileMetadataJSON
}

class AudioFile {
  index: number | null = null
  ino: string | null = null
  metadata: FileMetadata | null = null
  addedAt: number | null = null
  updatedAt: number | null = null

  trackNumFromMeta: number | null = null
  discNumFromMeta: number | null = null
  trackNumFromFilename: number | null = null
  discNumFromFilename: number | null = null

  format: string | null = null
  duration: number | null = null
  bitRate: number | null = null
  language: string | null = null
  codec: string | null = null
  timeBase: string | null = null
  channels: number | null = null
  channelLayout: string | null = null
  chapters: AudioFileChapter[] = []
  embeddedCoverArt: string | null = null

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

  toJSON(): AudioFileData {
    return {
      index: this.index,
      ino: this.ino,
      metadata: (this.metadata as FileMetadata).toJSON(),
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
    this.index = data.index as number
    this.ino = data.ino as string
    this.metadata = new FileMetadata((data.metadata || {}) as FileMetadataJSON)
    this.addedAt = data.addedAt as number
    this.updatedAt = data.updatedAt as number
    this.manuallyVerified = !!data.manuallyVerified
    this.exclude = !!data.exclude
    this.error = data.error || null

    this.trackNumFromMeta = data.trackNumFromMeta as number
    this.discNumFromMeta = data.discNumFromMeta as number
    this.trackNumFromFilename = data.trackNumFromFilename as number

    if (data.cdNumFromFilename !== undefined) this.discNumFromFilename = data.cdNumFromFilename // TEMP:Support old var name
    else this.discNumFromFilename = data.discNumFromFilename as number

    this.format = data.format as string
    this.duration = data.duration as number
    this.bitRate = data.bitRate as number
    this.language = data.language as string
    this.codec = data.codec || null
    this.timeBase = data.timeBase as string
    this.channels = data.channels as number
    this.channelLayout = data.channelLayout as string
    this.chapters = data.chapters as AudioFileChapter[]
    this.embeddedCoverArt = data.embeddedCoverArt || null

    this.metaTags = new AudioMetaTags(data.metaTags || {})
  }

  get mimeType(): string {
    const format = (this.metadata as FileMetadata).format.toUpperCase()
    const mimeType = (AudioMimeType as Record<string, string | undefined>)[format]
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

  /** @returns true if the chapters changed */
  syncChapters(updatedChapters: AudioFileChapter[]): boolean {
    if (this.chapters.length !== updatedChapters.length) {
      this.chapters = updatedChapters.map((ch) => ({ ...ch }))
      return true
    } else if (updatedChapters.length === 0) {
      if (this.chapters.length > 0) {
        this.chapters = []
        return true
      }
      return false
    }

    let hasUpdates = false
    for (let i = 0; i < updatedChapters.length; i++) {
      if (JSON.stringify(updatedChapters[i]) !== JSON.stringify(this.chapters[i])) {
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
    const current = this as unknown as Record<string, unknown>
    const scanned = newjson as unknown as Record<string, unknown>

    for (const key in newjson) {
      if (key === 'metadata') {
        if ((this.metadata as FileMetadata).update(newjson.metadata)) {
          hasUpdated = true
        }
      } else if (key === 'metaTags') {
        if (!this.metaTags || !this.metaTags.isEqual(scannedAudioFile.metaTags)) {
          this.metaTags = (scannedAudioFile.metaTags as AudioMetaTags).clone()
          hasUpdated = true
        }
      } else if (key === 'chapters') {
        if (this.syncChapters(newjson.chapters || [])) {
          hasUpdated = true
        }
      } else if (!ignoreKeys.includes(key) && current[key] !== scanned[key]) {
        current[key] = scanned[key]
        hasUpdated = true
      }
    }
    return hasUpdated
  }
}

export = AudioFile
