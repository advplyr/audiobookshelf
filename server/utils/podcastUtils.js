const Logger = require('../Logger')
const { xmlToJSON } = require('./index')

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
  var arrayFields = ['title', 'language', 'description', 'itunes:explicit', 'itunes:author']
  var metadata = {
    image: extractImage(channel),
    categories: extractCategories(channel)
  }
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
  var arrayFields = ['title', 'pubDate', 'description', 'itunes:episodeType', 'itunes:episode', 'itunes:author', 'itunes:duration', 'itunes:explicit']
  var episode = {
    enclosure: {
      ...item.enclosure[0]['$']
    }
  }
  arrayFields.forEach((key) => {
    var cleanKey = key.split(':').pop()
    episode[cleanKey] = extractFirstArrayItem(item, key)
  })
  return episode
}

function extractPodcastEpisodes(items) {
  var episodes = []
  items.forEach((item) => {
    var cleaned = extractEpisodeData(item)
    if (cleaned) {
      episodes.push(cleaned)
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

module.exports.parsePodcastRssFeedXml = async (xml) => {
  if (!xml) return null
  var json = await xmlToJSON(xml)
  if (!json || !json.rss) {
    Logger.error('[podcastUtils] Invalid XML or RSS feed')
    return null
  }
  return cleanPodcastJson(json.rss)
}