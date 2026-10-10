import axios from 'axios'
import ssrfFilter from 'ssrf-req-filter'
import Logger from '../Logger'
import { xmlToJSON, timestampToSeconds } from './index'
import htmlSanitizer from '../utils/htmlSanitizer'
import Fuse from '../libs/fusejs'
import type { RssXmlNode, RssMetadataValue, RssPodcastEpisode, RssPodcastMetadata, RssPodcast, RssItem, RssCategory, RssChannel, RssXmlDocument, ParsedPodcastFeed, RssEnclosure, EpisodeMatch, RedirectRequestError } from '../types/podcastUtils'
export type { RssPodcastChapter, RssPodcastEpisode, RssPodcastMetadata, RssPodcast } from '../types/podcastUtils'

// Keep sibling calls tied to the live CommonJS exports, including callers that replace a helper.
const podcastUtils = module.exports as {
  parsePodcastRssFeedXml: typeof parsePodcastRssFeedXml
  getPodcastFeed: typeof getPodcastFeed
  findMatchingEpisodesInFeed: typeof findMatchingEpisodesInFeed
}

type ExtractedEpisode = Partial<Omit<RssPodcastEpisode, 'enclosure' | 'publishedAt'>> & { enclosure: RssEnclosure }

function extractFirstArrayItem(json: RssXmlNode, key: string): RssMetadataValue {
  // xml2js stores element values in arrays; retain the legacy array-like access.
  const values = json[key] as Array<string | RssXmlNode> | undefined
  if (!values?.length) return null
  return values[0]
}

function extractStringOrStringify(json: RssXmlNode): string {
  try {
    const firstValue = json[Object.keys(json)[0]] as unknown[] | undefined
    if (typeof firstValue?.[0] === 'string') {
      return firstValue[0]
    }
    // Handles case where html was included without being wrapped in CDATA
    return JSON.stringify(json)
  } catch {
    return ''
  }
}

function extractFirstArrayItemString(json: RssXmlNode, key: string): string {
  const item = extractFirstArrayItem(json, key)
  if (!item) return ''
  if (typeof item === 'object') {
    if (item?.['_'] && typeof item['_'] === 'string') return item['_']

    return extractStringOrStringify(item)
  }
  return typeof item === 'string' ? item : ''
}

function extractImage(channel: RssChannel): string | null {
  if (!channel.image || !channel.image.url || !channel.image.url.length) {
    if (!channel['itunes:image'] || !channel['itunes:image'].length || !channel['itunes:image'][0]['$']) {
      return null
    }
    var itunesImage = channel['itunes:image'][0]['$']
    return itunesImage.href || null
  }
  return channel.image.url[0] || null
}

function extractCategories(channel: RssCategory): string[] {
  if (!channel['itunes:category'] || !channel['itunes:category'].length) return []
  var categories = channel['itunes:category']
  var cleanedCats: string[] = []
  categories.forEach((cat) => {
    if (!cat['$'] || !cat['$'].text) return
    var cattext = cat['$'].text
    if (cat['itunes:category']) {
      var subcats = extractCategories(cat)
      if (subcats.length) {
        cleanedCats = cleanedCats.concat(subcats.map((subcat) => `${cattext}:${subcat}`))
      } else {
        cleanedCats.push(cattext)
      }
    } else {
      cleanedCats.push(cattext)
    }
  })
  return cleanedCats
}

function extractPodcastMetadata(channel: RssChannel): RssPodcastMetadata {
  const metadata: RssPodcastMetadata = {
    image: extractImage(channel),
    categories: extractCategories(channel),
    feedUrl: null,
    description: null,
    descriptionPlain: null,
    type: null
  }

  if (channel['itunes:new-feed-url']) {
    metadata.feedUrl = extractFirstArrayItem(channel, 'itunes:new-feed-url')
  } else if (channel['atom:link'] && channel['atom:link'].length && channel['atom:link'][0]['$']) {
    metadata.feedUrl = channel['atom:link'][0]['$'].href || null
  }

  if (channel['description']) {
    const rawDescription = extractFirstArrayItemString(channel, 'description')
    metadata.description = htmlSanitizer.sanitize(rawDescription.trim())
    metadata.descriptionPlain = htmlSanitizer.stripAllTags(rawDescription.trim())
  }

  const arrayFields = ['title', 'language', 'itunes:explicit', 'itunes:author', 'pubDate', 'link', 'itunes:type']
  arrayFields.forEach((key) => {
    const cleanKey = key.split(':').pop()!
    let value = extractFirstArrayItem(channel, key)
    if (typeof value === 'object' && value?.['_']) value = value['_']
    metadata[cleanKey] = value
  })
  return metadata
}

function extractEpisodeData(item: RssItem): ExtractedEpisode | null {
  // Episode must have url
  let enclosure

  if (item.enclosure?.[0]?.['$']?.url) {
    enclosure = item.enclosure[0]['$']
  } else if (item['media:content']?.find((c) => c?.['$']?.url && (c?.['$']?.type ?? '').startsWith('audio'))) {
    enclosure = item['media:content'].find((c) => (c['$']?.type ?? '').startsWith('audio'))!['$']
  } else {
    Logger.error(`[podcastUtils] Invalid podcast episode data`)
    return null
  }

  const episode: ExtractedEpisode = {
    // Successful URL trimming below establishes the required enclosure URL.
    enclosure: enclosure as RssEnclosure
  }

  episode.enclosure.url = episode.enclosure.url.trim()

  // Full description with html
  if (item['content:encoded']) {
    const rawDescription = (extractFirstArrayItemString(item, 'content:encoded') || '').trim()
    episode.description = htmlSanitizer.sanitize(rawDescription)
  }

  // Extract chapters
  if (item['podcast:chapters']?.[0]?.['$']?.url) {
    episode.chaptersUrl = item['podcast:chapters'][0]['$'].url
    episode.chaptersType = item['podcast:chapters'][0]['$'].type || 'application/json'
  }

  // Supposed to be the plaintext description but not always followed
  if (item['description']) {
    const rawDescription = extractFirstArrayItemString(item, 'description')

    if (!episode.description) episode.description = htmlSanitizer.sanitize(rawDescription.trim())
    episode.descriptionPlain = htmlSanitizer.stripAllTags(rawDescription.trim())
  }

  if (item['pubDate']) {
    const pubDate = extractFirstArrayItem(item, 'pubDate')
    if (typeof pubDate === 'string') {
      episode.pubDate = pubDate
    } else if (typeof pubDate === 'object' && typeof pubDate?._ === 'string') {
      episode.pubDate = pubDate._
    } else {
      Logger.error(`[podcastUtils] Invalid pubDate ${String(item['pubDate'])} for ${episode.enclosure.url}`)
    }
  }

  if (item['guid']) {
    const guidItem = extractFirstArrayItem(item, 'guid')
    if (typeof guidItem === 'string') {
      episode.guid = guidItem
    } else if (typeof guidItem === 'object' && typeof guidItem?._ === 'string') {
      episode.guid = guidItem._
    } else {
      Logger.error(`[podcastUtils] Invalid guid for ${episode.enclosure.url}`, item['guid'])
    }
  }

  const arrayFields = ['title', 'itunes:episodeType', 'itunes:season', 'itunes:episode', 'itunes:author', 'itunes:duration', 'itunes:explicit', 'itunes:subtitle'] as const
  arrayFields.forEach((key) => {
    const cleanKey = key.split(':').pop() as 'title' | 'episodeType' | 'season' | 'episode' | 'author' | 'duration' | 'explicit' | 'subtitle'
    episode[cleanKey] = extractFirstArrayItemString(item, key)
  })

  if (episode.subtitle) {
    episode.subtitle = htmlSanitizer.sanitize(episode.subtitle.trim())
  }

  // Extract psc:chapters if duration is set
  episode.durationSeconds = episode.duration ? timestampToSeconds(episode.duration) : null

  if (item['psc:chapters']?.[0]?.['psc:chapter']?.length && episode.durationSeconds) {
    // Example chapter:
    // {"id":0,"start":0,"end":43.004286,"title":"chapter 1"}

    const cleanedChapters = item['psc:chapters'][0]['psc:chapter'].map((chapter, index) => {
      if (!chapter['$']?.title || !chapter['$']?.start || typeof chapter['$']?.start !== 'string' || typeof chapter['$']?.title !== 'string') {
        return null
      }

      const start = timestampToSeconds(chapter['$'].start)
      if (start === null) {
        return null
      }

      return {
        id: index,
        title: chapter['$'].title,
        start
      }
    })

    if (cleanedChapters.some((chapter) => !chapter)) {
      Logger.warn(`[podcastUtils] Invalid chapter data for ${episode.enclosure.url}`)
    } else {
      episode.chapters = cleanedChapters.map((chapter, index) => {
        const nextChapter = cleanedChapters[index + 1]
        const end = nextChapter ? nextChapter.start : episode.durationSeconds!
        return {
          // The some() check above ensures every chapter parsed successfully.
          id: chapter!.id,
          title: chapter!.title,
          start: chapter!.start,
          end
        }
      })
    }
  }

  return episode
}

function cleanEpisodeData(data: ExtractedEpisode): RssPodcastEpisode {
  const pubJsDate = data.pubDate ? new Date(data.pubDate) : null
  const publishedAt = pubJsDate && !isNaN(Number(pubJsDate)) ? pubJsDate.valueOf() : null

  return {
    title: data.title!,
    subtitle: data.subtitle || '',
    description: data.description || '',
    descriptionPlain: data.descriptionPlain || '',
    pubDate: data.pubDate || '',
    episodeType: data.episodeType || '',
    season: data.season || '',
    episode: data.episode || '',
    author: data.author || '',
    duration: data.duration || '',
    durationSeconds: data.durationSeconds || null,
    explicit: data.explicit || '',
    publishedAt,
    enclosure: data.enclosure,
    guid: data.guid || null,
    chaptersUrl: data.chaptersUrl || null,
    chaptersType: data.chaptersType || null,
    chapters: data.chapters || []
  }
}

function extractPodcastEpisodes(items: RssItem[]): RssPodcastEpisode[] {
  const episodes: RssPodcastEpisode[] = []
  items.forEach((item) => {
    const extracted = extractEpisodeData(item)
    if (extracted) {
      episodes.push(cleanEpisodeData(extracted))
    }
  })
  return episodes
}

function cleanPodcastJson(rssJson: NonNullable<RssXmlDocument['rss']>, excludeEpisodeMetadata: boolean): RssPodcast | null {
  if (!rssJson.channel?.length) {
    Logger.error(`[podcastUtil] Invalid podcast no channel object`)
    return null
  }
  const channel = rssJson.channel[0]
  if (!channel.item?.length) {
    Logger.error(`[podcastUtil] Invalid podcast no episodes`)
    return null
  }
  const podcast: { metadata: RssPodcastMetadata; episodes?: RssPodcastEpisode[]; numEpisodes?: number } = {
    metadata: extractPodcastMetadata(channel)
  }
  if (!excludeEpisodeMetadata) {
    podcast.episodes = extractPodcastEpisodes(channel.item)
  } else {
    podcast.numEpisodes = channel.item.length
  }
  // The branches above always set exactly one of episodes and numEpisodes.
  return podcast as RssPodcast
}

export const parsePodcastRssFeedXml = async (xml: string | Buffer | null | undefined, excludeEpisodeMetadata = false, includeRaw = false): Promise<ParsedPodcastFeed | null> => {
  if (!xml) return null
  // Preserve permissive RSS parsing; this boundary describes xml2js output, without validating it.
  const json = (await xmlToJSON(xml)) as RssXmlDocument | null
  if (!json?.rss) {
    Logger.error('[podcastUtils] Invalid XML or RSS feed')
    return null
  }

  const podcast = cleanPodcastJson(json.rss, excludeEpisodeMetadata)
  if (!podcast) return null

  if (includeRaw) {
    return {
      podcast,
      rawJson: json
    }
  } else {
    return {
      podcast
    }
  }
}

/**
 * Get podcast RSS feed as JSON
 * Uses SSRF filter to prevent internal URLs
 *
 * @param {string} feedUrl
 * @param {boolean} [excludeEpisodeMetadata=false]
 * @returns {Promise<RssPodcast|null>}
 */
export const getPodcastFeed = (feedUrl: string, excludeEpisodeMetadata = false): Promise<RssPodcast | null> => {
  Logger.debug(`[podcastUtils] getPodcastFeed for "${feedUrl}"`)

  let userAgent = 'audiobookshelf (+https://audiobookshelf.org; like iTMS)'
  // Workaround for CBC RSS feeds rejecting our user agent string
  // See: https://github.com/advplyr/audiobookshelf/issues/3322
  if (feedUrl.startsWith('https://www.cbc.ca')) {
    userAgent = 'audiobookshelf (+https://audiobookshelf.org; like iTMS) - CBC'
  }

  return axios({
    url: feedUrl,
    method: 'GET',
    timeout: global.PodcastDownloadTimeout,
    responseType: 'arraybuffer',
    headers: {
      Accept: 'application/rss+xml, application/xhtml+xml, application/xml, */*;q=0.8',
      'Accept-Encoding': 'gzip, compress, deflate',
      'User-Agent': userAgent
    },
    httpAgent: global.DisableSsrfRequestFilter?.(feedUrl) ? null : ssrfFilter(feedUrl),
    httpsAgent: global.DisableSsrfRequestFilter?.(feedUrl) ? null : ssrfFilter(feedUrl)
  })
    .then(async (data: { data: Buffer | string; headers?: Record<string, string> }) => {
      // Adding support for ios-8859-1 encoded RSS feeds.
      //  See: https://github.com/advplyr/audiobookshelf/issues/1489
      const contentType = data.headers?.['content-type'] || '' // e.g. text/xml; charset=iso-8859-1
      const responseBody: { toString(encoding?: BufferEncoding): string } = data.data
      if (contentType.toLowerCase().includes('iso-8859-1')) {
        data.data = responseBody.toString('latin1')
      } else {
        data.data = responseBody.toString()
      }

      if (!data?.data) {
        Logger.error(`[podcastUtils] getPodcastFeed: Invalid podcast feed request response (${feedUrl})`)
        return null
      }
      Logger.debug(`[podcastUtils] getPodcastFeed for "${feedUrl}" success - parsing xml`)
      const payload = await podcastUtils.parsePodcastRssFeedXml(data.data, excludeEpisodeMetadata)
      if (!payload) {
        return null
      }

      // RSS feed may be a private RSS feed
      payload.podcast.metadata.feedUrl = feedUrl

      return payload.podcast
    })
    .catch((error: unknown) => {
      // Keep legacy redirect handling, including errors for malformed redirect error objects.
      const requestError = error as RedirectRequestError
      // Check for failures due to redirecting from http to https. If original url was http, upgrade to https and try again
      if (requestError.code === 'ERR_FR_REDIRECTION_FAILURE' && requestError.cause.code === 'ERR_INVALID_PROTOCOL') {
        if (feedUrl.startsWith('http://') && requestError.request._options.protocol === 'https:') {
          Logger.info('Redirection from http to https detected. Upgrading Request', requestError.request._options.href)
          feedUrl = feedUrl.replace('http://', 'https://')
          return podcastUtils.getPodcastFeed(feedUrl, excludeEpisodeMetadata)
        }
      }
      Logger.error('[podcastUtils] getPodcastFeed Error', error)
      return null
    })
}

// Return array of episodes ordered by closest match using fuse.js
export const findMatchingEpisodes = async (feedUrl: string, searchTitle: string): Promise<EpisodeMatch[] | null> => {
  const feed = await podcastUtils.getPodcastFeed(feedUrl).catch(() => {
    return null
  })

  return podcastUtils.findMatchingEpisodesInFeed(feed, searchTitle)
}

/**
 *
 * @param {RssPodcast} feed
 * @param {string} searchTitle
 * @param {number} [threshold=0.4] - 0.0 for perfect match, 1.0 for match anything
 * @returns {Array<{ episode: RssPodcastEpisode }>}
 */
export const findMatchingEpisodesInFeed = (feed: RssPodcast | null | undefined, searchTitle: string, threshold = 0.4): EpisodeMatch[] | null => {
  if (!feed?.episodes) {
    return null
  }

  const fuseOptions = {
    ignoreDiacritics: true,
    threshold,
    keys: [
      { name: 'title', weight: 0.7 }, // prefer match in title
      { name: 'subtitle', weight: 0.3 }
    ]
  }
  const fuse = new Fuse(feed.episodes, fuseOptions)

  const matches: EpisodeMatch[] = []
  fuse.search(searchTitle).forEach((match) => {
    matches.push({
      episode: match.item
    })
  })
  return matches
}
