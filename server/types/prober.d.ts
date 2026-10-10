import type AudioMetaTags from '../objects/metadata/AudioMetaTags'

export type ProbeNumber = number | string | null | undefined
export type ProbeTags = Record<string, string | undefined>

export interface RawProbeStream {
  index: number
  codec_type: string
  codec_name?: string
  codec_long_name?: string
  codec_time_base?: string
  time_base?: string
  bit_rate?: ProbeNumber
  tags?: ProbeTags
  disposition?: { default?: number | string }
  profile?: string
  is_avc?: string | boolean | number
  pix_fmt?: string
  avg_frame_rate?: string
  r_frame_rate?: string
  width?: ProbeNumber
  height?: ProbeNumber
  color_range?: string
  color_space?: string
  color_transfer?: string
  color_primaries?: string
  channels?: number | string
  sample_rate?: ProbeNumber
  channel_layout?: string
}

export interface RawProbeChapter {
  'TAG:title'?: string
  title?: string
  tags?: ProbeTags
  time_base?: string
  start_time?: ProbeNumber
  end_time?: ProbeNumber
  start?: ProbeNumber
  end?: ProbeNumber
}

export interface RawProbeData {
  format: {
    format_long_name?: string
    name?: string
    duration?: ProbeNumber
    size?: ProbeNumber
    bit_rate?: ProbeNumber
    tags?: ProbeTags
  }
  streams: RawProbeStream[]
  chapters?: RawProbeChapter[]
  error?: { string?: string }
}

export interface ProbeStream {
  index: number
  type: string
  codec: string | null
  codec_long: string | null
  codec_time_base: string | null
  time_base: string | null
  bit_rate: number | null
  language: string | null
  title: string | null
  tags?: ProbeTags
  is_default?: boolean
  profile?: string | null
  is_avc?: boolean
  pix_fmt?: string | null
  frame_rate?: number | null
  width?: number | null
  height?: number | null
  color_range?: string | null
  color_space?: string | null
  color_transfer?: string | null
  color_primaries?: string | null
  channels?: number | string | null
  sample_rate?: number | null
  channel_layout?: string | null
}

export interface ProbeChapter {
  start: number
  end: number
  title: string
  id: number
}

export interface ParsedProbeData {
  format: string
  duration: number | null
  size: number | null
  sizeMb: number | null
  bit_rate: number | null
  tags: Record<string, string | null | undefined>
  rawTags?: ProbeTags
  video_stream?: ProbeStream
  audio_stream?: ProbeStream | null
  chapters?: ProbeChapter[]
}

// Successful setData calls populate these fields on the existing JS class.
export interface ProbedMedia {
  embeddedCoverArt: string | null
  format: string
  duration: number | null
  size: number | null
  audioStream: ProbeStream
  videoStream: ProbeStream | null
  bitRate: number | null
  codec: string | null
  timeBase: string | null
  language: string | null
  channelLayout: string | null | undefined
  channels: number | string | null | undefined
  sampleRate: number | null | undefined
  chapters: ProbeChapter[]
  audioMetaTags: AudioMetaTags
  trackNumber: null
  trackTotal: null
  discNumber: null
  discTotal: null
  setData(data: ParsedProbeData): void
  construct(data: Partial<ProbedMedia>): void
}

export interface ProbeFailure {
  error: unknown
}
