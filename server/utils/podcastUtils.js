const axios = require('axios')
const ssrfFilter = require('ssrf-req-filter')
const Logger = require('../Logger')
const { xmlToJSON, levenshteinDistance } = require('./index')
const htmlSanitizer = require('../utils/htmlSanitizer')

function extractFirstArrayItem(json, key) {
  if (!json[key]?.length) return null
  return json[key][0]
}

function extractImage(channel) {
  if (!channel.image || !channel.image.url || !channel.image.url.length) {
    if (!channel['itunes:image'] || !channel['itunes:image'].length || !channel['itunes:image'][0]['$']) {
      return null
    }
    var itunesImage = channel['itunes:image'][0]['$']
    return itunesImage.href || null
  }
  return channel.image.url[0] || null
}

function extractCategories(channel) {
  if (!channel['itunes:category'] || !channel['itunes:category'].length) return []
  var categories = channel['itunes:category']
  var cleanedCats = []
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

function extractPodcastMetadata(channel) {
  const metadata = {
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
    const rawDescription = extractFirstArrayItem(channel, 'description') || ''
    metadata.description = htmlSanitizer.sanitize(rawDescription.trim())
    metadata.descriptionPlain = htmlSanitizer.stripAllTags(rawDescription.trim())
  }

  const arrayFields = ['title', 'language', 'itunes:explicit', 'itunes:author', 'pubDate', 'link', 'itunes:type']
  arrayFields.forEach((key) => {
    const cleanKey = key.split(':').pop()
    let value = extractFirstArrayItem(channel, key)
    if (value?.['_']) value = value['_']
    metadata[cleanKey] = value
  })
  return metadata
}

function extractEpisodeData(item) {
  // Episode must have url
  if (!item.enclosure?.[0]?.['$']?.url) {
    Logger.error(`[podcastUtils] Invalid podcast episode data`)
    return null
  }

  const episode = {
    enclosure: {
      ...item.enclosure[0]['$']
    }
  }

  episode.enclosure.url = episode.enclosure.url.trim()

  // Full description with html
  if (item['content:encoded']) {
    const rawDescription = (extractFirstArrayItem(item, 'content:encoded') || '').trim()
    episode.description = htmlSanitizer.sanitize(rawDescription)
  }

  // Extract chapters
  if (item['podcast:chapters']?.[0]?.['$']?.url) {
    episode.chaptersUrl = item['podcast:chapters'][0]['$'].url
    episode.chaptersType = item['podcast:chapters'][0]['$'].type || 'application/json'
  }

  // Supposed to be the plaintext description but not always followed
  if (item['description']) {
    const rawDescription = extractFirstArrayItem(item, 'description') || ''
    if (!episode.description) episode.description = htmlSanitizer.sanitize(rawDescription.trim())
    episode.descriptionPlain = htmlSanitizer.stripAllTags(rawDescription.trim())
  }

  if (item['pubDate']) {
    const pubDate = extractFirstArrayItem(item, 'pubDate')
    if (typeof pubDate === 'string') {
      episode.pubDate = pubDate
    } else if (typeof pubDate?._ === 'string') {
      episode.pubDate = pubDate._
    } else {
      Logger.error(`[podcastUtils] Invalid pubDate ${item['pubDate']} for ${episode.enclosure.url}`)
    }
  }

  if (item['guid']) {
    const guidItem = extractFirstArrayItem(item, 'guid')
    if (typeof guidItem === 'string') {
      episode.guid = guidItem
    } else if (typeof guidItem?._ === 'string') {
      episode.guid = guidItem._
    } else {
      Logger.error(`[podcastUtils] Invalid guid ${item['guid']} for ${episode.enclosure.url}`)
    }
  }

  const arrayFields = ['title', 'itunes:episodeType', 'itunes:season', 'itunes:episode', 'itunes:author', 'itunes:duration', 'itunes:explicit', 'itunes:subtitle']
  arrayFields.forEach((key) => {
    const cleanKey = key.split(':').pop()
    let value = extractFirstArrayItem(item, key)
    if (value?.['_']) value = value['_']
    episode[cleanKey] = value
  })
  return episode
}

function cleanEpisodeData(data) {
  const pubJsDate = data.pubDate ? new Date(data.pubDate) : null
  const publishedAt = pubJsDate && !isNaN(pubJsDate) ? pubJsDate.valueOf() : null
  return {
    title: data.title,
    subtitle: data.subtitle || '',
    description: data.description || '',
    descriptionPlain: data.descriptionPlain || '',
    pubDate: data.pubDate || '',
    episodeType: data.episodeType || '',
    season: data.season || '',
    episode: data.episode || '',
    author: data.author || '',
    duration: data.duration || '',
    explicit: data.explicit || '',
    publishedAt,
    enclosure: data.enclosure,
    guid: data.guid || null,
    chaptersUrl: data.chaptersUrl || null,
    chaptersType: data.chaptersType || null
  }
}

function extractPodcastEpisodes(items) {
  const episodes = []
  items.forEach((item) => {
    const extracted = extractEpisodeData(item)
    if (extracted) {
      episodes.push(cleanEpisodeData(extracted))
    }
  })
  return episodes
}

function cleanPodcastJson(rssJson, excludeEpisodeMetadata) {
  if (!rssJson.channel?.length) {
    Logger.error(`[podcastUtil] Invalid podcast no channel object`)
    return null
  }
  const channel = rssJson.channel[0]
  if (!channel.item?.length) {
    Logger.error(`[podcastUtil] Invalid podcast no episodes`)
    return null
  }
  const podcast = {
    metadata: extractPodcastMetadata(channel)
  }
  if (!excludeEpisodeMetadata) {
    podcast.episodes = extractPodcastEpisodes(channel.item)
  } else {
    podcast.numEpisodes = channel.item.length
  }
  return podcast
}

module.exports.parsePodcastRssFeedXml = async (xml, excludeEpisodeMetadata = false, includeRaw = false) => {
  if (!xml) return null
  const json = await xmlToJSON(xml)
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
 * @returns {Promise}
 */
module.exports.getPodcastFeed = (feedUrl, excludeEpisodeMetadata = false) => {
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
    timeout: 12000,
    responseType: 'arraybuffer',
    headers: {
      Accept: 'application/rss+xml, application/xhtml+xml, application/xml, */*;q=0.8',
      'User-Agent': userAgent
    },
    httpAgent: global.DisableSsrfRequestFilter?.(feedUrl) ? null : ssrfFilter(feedUrl),
    httpsAgent: global.DisableSsrfRequestFilter?.(feedUrl) ? null : ssrfFilter(feedUrl)
  })
    .then(async (data) => {
      // Adding support for ios-8859-1 encoded RSS feeds.
      //  See: https://github.com/advplyr/audiobookshelf/issues/1489
      const contentType = data.headers?.['content-type'] || '' // e.g. text/xml; charset=iso-8859-1
      if (contentType.toLowerCase().includes('iso-8859-1')) {
        data.data = data.data.toString('latin1')
      } else {
        data.data = data.data.toString()
      }

      if (!data?.data) {
        Logger.error(`[podcastUtils] getPodcastFeed: Invalid podcast feed request response (${feedUrl})`)
        return null
      }
      Logger.debug(`[podcastUtils] getPodcastFeed for "${feedUrl}" success - parsing xml`)
      const payload = await this.parsePodcastRssFeedXml(data.data, excludeEpisodeMetadata)
      if (!payload) {
        return null
      }

      // RSS feed may be a private RSS feed
      payload.podcast.metadata.feedUrl = feedUrl

      return payload.podcast
    })
    .catch((error) => {
      Logger.error('[podcastUtils] getPodcastFeed Error', error)
      return null
    })
}

// Return array of episodes ordered by closest match (Levenshtein distance of 6 or less)
module.exports.findMatchingEpisodes = async (feedUrl, searchTitle) => {
  const feed = await this.getPodcastFeed(feedUrl).catch(() => {
    return null
  })

  return this.findMatchingEpisodesInFeed(feed, searchTitle)
}

module.exports.findMatchingEpisodesInFeed = (feed, searchTitle) => {
  searchTitle = searchTitle.toLowerCase().trim()
  if (!feed?.episodes) {
    return null
  }

  const matches = []
  feed.episodes.forEach((ep) => {
    if (!ep.title) return
    const epTitle = ep.title.toLowerCase().trim()
    if (epTitle === searchTitle) {
      matches.push({
        episode: ep,
        levenshtein: 0
      })
    } else {
      const levenshtein = levenshteinDistance(searchTitle, epTitle, true)
      if (levenshtein <= 6 && epTitle.length > levenshtein) {
        matches.push({
          episode: ep,
          levenshtein
        })
      }
    }
  })
  return matches.sort((a, b) => a.levenshtein - b.levenshtein)
}
