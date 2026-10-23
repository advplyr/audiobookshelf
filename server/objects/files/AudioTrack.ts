import type AudioFile from './AudioFile'
import FileMetadata from '../metadata/FileMetadata'

type FileMetadataJSON = ReturnType<FileMetadata['toJSON']>

interface AudioTrackData {
  index: number | null | undefined
  startOffset: number | null
  duration: number | null | undefined
  title: string | null
  contentUrl: string | null
  mimeType: string | null
  codec: string | null
  metadata: FileMetadataJSON | null
}

class AudioTrack {
  index: number | null | undefined = null
  startOffset: number | null = null
  duration: number | null | undefined = null
  title: string | null = null
  contentUrl: string | null = null
  mimeType: string | null = null
  codec: string | null = null
  metadata: FileMetadata | null = null

  toJSON(): AudioTrackData {
    return {
      index: this.index,
      startOffset: this.startOffset,
      duration: this.duration,
      title: this.title,
      contentUrl: this.contentUrl,
      mimeType: this.mimeType,
      codec: this.codec,
      metadata: this.metadata?.toJSON() || null
    }
  }

  setData(itemId: string, audioFile: AudioFile, startOffset: number) {
    const audioFileMetadata = audioFile.metadata!

    this.index = audioFile.index
    this.startOffset = startOffset
    this.duration = audioFile.duration
    this.title = audioFileMetadata.filename || ''

    this.contentUrl = `/api/items/${itemId}/file/${audioFile.ino}`
    this.mimeType = audioFile.mimeType
    this.codec = audioFile.codec || null
    this.metadata = audioFileMetadata.clone()
  }

  setFromStream(title: string, duration: number, contentUrl: string) {
    this.index = 1
    this.startOffset = 0
    this.duration = duration
    this.title = title
    this.contentUrl = contentUrl
    this.mimeType = 'application/vnd.apple.mpegurl'
  }
}

export = AudioTrack
