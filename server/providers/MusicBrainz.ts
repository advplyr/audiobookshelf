import axios from 'axios'
import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import packageJson from '../../package.json'
import Logger from '../Logger'
import { isNullOrNaN } from '../utils/index'

type TrackOptions = { artist?: string; isrc?: string; title?: string; album?: string; limit?: string | number | null }
// axios ignores the legacy third argument; keep the same call and receiver.
const legacyAxios: {
  get(url: string, params: AxiosRequestConfig, config: AxiosRequestConfig): Promise<AxiosResponse<{ recordings?: Record<string, unknown>[] }>>
} = axios

class MusicBrainz {

  get userAgentString() {
    return `audiobookshelf/${packageJson.version} (https://audiobookshelf.org)`
  }

  // https://musicbrainz.org/doc/MusicBrainz_API/Search
  searchTrack(options: TrackOptions) {
    let luceneParts = []
    if (options.artist) {
      luceneParts.push(`artist:${options.artist}`)
    }
    if (options.isrc) {
      luceneParts.push(`isrc:${options.isrc}`)
    }
    if (options.title) {
      luceneParts.push(`recording:${options.title}`)
    }
    if (options.album) {
      luceneParts.push(`release:${options.album}`)
    }
    if (!luceneParts.length) {
      Logger.error(`[MusicBrainz] Invalid search options - must have at least one of artist, isrc, title, album`)
      return []
    }

    const query = {
      query: luceneParts.join(' AND '),
      limit: isNullOrNaN(options.limit) ? 15 : Number(options.limit),
      fmt: 'json'
    }
    const config = {
      headers: {
        'User-Agent': this.userAgentString
      }
    }
    return legacyAxios.get('https://musicbrainz.org/ws/2/recording', { params: query }, config).then((response) => {
      return response.data.recordings || []
    }).catch((error: unknown) => {
      Logger.error(`[MusicBrainz] search request error`, error)
      return []
    })
  }
}
export = MusicBrainz