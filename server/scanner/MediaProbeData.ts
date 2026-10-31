import AudioMetaTags from '../objects/metadata/AudioMetaTags'
import type { ParsedProbeData, ProbeChapter, ProbeStream } from '../types/prober'

type AudioMetaTagsJSON = ReturnType<AudioMetaTags['toJSON']>

interface MediaProbeDataFields {
  embeddedCoverArt: string | null
  format: string | null
  duration: number | null
  size: number | null

  audioStream: ProbeStream | null
  videoStream: ProbeStream | null

  bitRate: number | null
  codec: string | null
  timeBase: string | null
  language: string | null
  channelLayout: string | null | undefined
  channels: number | string | null | undefined
  sampleRate: number | null | undefined
  chapters: ProbeChapter[]

  audioMetaTags: AudioMetaTags | null

  trackNumber: number | null
  trackTotal: number | null

  discNumber: number | null
  discTotal: number | null
}

/** Stored probe data. Tags may be plain json */
type MediaProbeConstructData = Partial<Omit<MediaProbeDataFields, 'audioMetaTags'>> & { audioMetaTags?: AudioMetaTagsJSON | AudioMetaTags | null }

class MediaProbeData {
  embeddedCoverArt: string | null = null
  format: string | null = null
  duration: number | null = null
  size: number | null = null

  audioStream: ProbeStream | null = null
  videoStream: ProbeStream | null = null

  bitRate: number | null = null
  codec: string | null = null
  timeBase: string | null = null
  language: string | null = null
  channelLayout: string | null | undefined = null
  channels: number | string | null | undefined = null
  sampleRate: number | null | undefined = null
  chapters: ProbeChapter[] = []

  audioMetaTags: AudioMetaTags | null = null

  trackNumber: number | null = null
  trackTotal: number | null = null

  discNumber: number | null = null
  discTotal: number | null = null

  constructor(probeData?: MediaProbeConstructData | null) {
    if (probeData) {
      this.construct(probeData)
    }
  }

  construct(probeData: MediaProbeConstructData) {
    for (const key in probeData) {
      const field = key as keyof MediaProbeDataFields
      if (field === 'audioMetaTags' && probeData[field]) {
        this[field] = new AudioMetaTags(probeData[field])
      } else if (this[field] !== undefined) {
        Object.assign(this, { [field]: probeData[field] })
      }
    }
  }

  setData(data: ParsedProbeData) {
    // Probed media without an audio stream throws here as it always has
    const audioStream = data.audio_stream as ProbeStream

    this.embeddedCoverArt = data.video_stream?.codec || null
    this.format = data.format
    this.duration = data.duration
    this.size = data.size

    this.audioStream = audioStream
    this.videoStream = this.embeddedCoverArt ? null : data.video_stream || null

    this.bitRate = audioStream.bit_rate || data.bit_rate
    this.codec = audioStream.codec
    this.timeBase = audioStream.time_base
    this.language = audioStream.language
    this.channelLayout = audioStream.channel_layout
    this.channels = audioStream.channels
    this.sampleRate = audioStream.sample_rate
    this.chapters = data.chapters || []

    this.audioMetaTags = new AudioMetaTags()
    this.audioMetaTags.setData(data.tags)
  }
}

export = MediaProbeData
