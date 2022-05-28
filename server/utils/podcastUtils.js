const Logger = require('../Logger')
const { xmlToJSON } = require('./index')
const htmlSanitizer = require('../utils/htmlSanitizer')

function extractFirstArrayItem(json, key) {
  if (!json[key] || !json[key].length) return null
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
  var metadata = {
    image: extractImage(channel),
    categories: extractCategories(channel),
    feedUrl: null,
    description: null,
    descriptionPlain: null
  }

  if (channel['itunes:new-feed-url']) {
    metadata.feedUrl = extractFirstArrayItem(channel, 'itunes:new-feed-url')
  } else if (channel['atom:link'] && channel['atom:link'].length && channel['atom:link'][0]['$']) {
    metadata.feedUrl = channel['atom:link'][0]['$'].href || null
  }

  if (channel['description']) {
    const rawDescription = extractFirstArrayItem(channel, 'description') || ''
    metadata.description = htmlSanitizer.sanitize(rawDescription)
    metadata.descriptionPlain = htmlSanitizer.stripAllTags(rawDescription)
  }

  var arrayFields = ['title', 'language', 'itunes:explicit', 'itunes:author', 'pubDate', 'link']
  arrayFields.forEach((key) => {
    var cleanKey = key.split(':').pop()
    metadata[cleanKey] = extractFirstArrayItem(channel, key)
  })
  return metadata
}

function extractEpisodeData(item) {
  // Episode must have url
  if (!item.enclosure || !item.enclosure.length || !item.enclosure[0]['$'] || !item.enclosure[0]['$'].url) {
    Logger.error(`[podcastUtils] Invalid podcast episode data`)
    return null
  }

  var episode = {
    enclosure: {
      ...item.enclosure[0]['$']
    }
  }

  // Full description with html
  if (item['content:encoded']) {
    const rawDescription = (extractFirstArrayItem(item, 'content:encoded') || '').trim()
    episode.description = htmlSanitizer.sanitize(rawDescription)
  }

  // Supposed to be the plaintext description but not always followed
  if (item['description']) {
    const rawDescription = extractFirstArrayItem(item, 'description') || ''
    if (!episode.description) episode.description = htmlSanitizer.sanitize(rawDescription)
    episode.descriptionPlain = htmlSanitizer.stripAllTags(rawDescription)
  }

  var arrayFields = ['title', 'pubDate', 'itunes:episodeType', 'itunes:season', 'itunes:episode', 'itunes:author', 'itunes:duration', 'itunes:explicit', 'itunes:subtitle']
  arrayFields.forEach((key) => {
    var cleanKey = key.split(':').pop()
    episode[cleanKey] = extractFirstArrayItem(item, key)
  })
  return episode
}

function cleanEpisodeData(data) {
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
    publishedAt: (new Date(data.pubDate)).valueOf(),
    enclosure: data.enclosure
  }
}

function extractPodcastEpisodes(items) {
  var episodes = []
  items.forEach((item) => {
    var extracted = extractEpisodeData(item)
    if (extracted) {
      episodes.push(cleanEpisodeData(extracted))
    }
  })
  return episodes
}

function cleanPodcastJson(rssJson) {
  if (!rssJson.channel || !rssJson.channel.length) {
    Logger.error(`[podcastUtil] Invalid podcast no channel object`)
    return null
  }
  var channel = rssJson.channel[0]
  if (!channel.item || !channel.item.length) {
    Logger.error(`[podcastUtil] Invalid podcast no episodes`)
    return null
  }
  var podcast = {
    metadata: extractPodcastMetadata(channel),
    episodes: extractPodcastEpisodes(channel.item)
  }
  return podcast
}

module.exports.parsePodcastRssFeedXml = async (xml, includeRaw = false) => {
  if (!xml) return null
  var json = await xmlToJSON(xml)
  if (!json || !json.rss) {
    Logger.error('[podcastUtils] Invalid XML or RSS feed')
    return null
  }

  const podcast = cleanPodcastJson(json.rss)
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