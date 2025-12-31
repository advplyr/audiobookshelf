const Logger = require('../Logger')

/**
 * Validate if a URL is a valid YouTube URL
 * Supports: youtube.com, youtu.be, music.youtube.com
 *
 * @param {string} url
 * @returns {boolean}
 */
function isValidYouTubeUrl(url) {
  if (!url || typeof url !== 'string') return false

  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase()

    // Support various YouTube domains
    const validHosts = [
      'www.youtube.com',
      'youtube.com',
      'youtu.be',
      'music.youtube.com',
      'm.youtube.com'
    ]

    if (!validHosts.includes(hostname)) return false

    // Check for video ID or playlist ID
    if (hostname === 'youtu.be') {
      return urlObj.pathname.length > 1
    }

    return urlObj.searchParams.has('v') || urlObj.searchParams.has('list') || urlObj.pathname.includes('/watch')
  } catch (error) {
    Logger.error('[youtubeUtils] Invalid URL:', error)
    return false
  }
}

/**
 * Extract video ID from YouTube URL
 *
 * @param {string} url
 * @returns {string|null}
 */
function extractVideoId(url) {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase()

    if (hostname === 'youtu.be') {
      return urlObj.pathname.slice(1).split('?')[0]
    }

    return urlObj.searchParams.get('v')
  } catch (error) {
    Logger.error('[youtubeUtils] Failed to extract video ID:', error)
    return null
  }
}

/**
 * Check if URL is a playlist
 *
 * @param {string} url
 * @returns {boolean}
 */
function isPlaylistUrl(url) {
  try {
    const urlObj = new URL(url)
    return urlObj.searchParams.has('list') || urlObj.pathname.includes('/playlist')
  } catch (error) {
    return false
  }
}

/**
 * Extract playlist ID from YouTube URL
 *
 * @param {string} url
 * @returns {string|null}
 */
function extractPlaylistId(url) {
  try {
    const urlObj = new URL(url)
    return urlObj.searchParams.get('list')
  } catch (error) {
    Logger.error('[youtubeUtils] Failed to extract playlist ID:', error)
    return null
  }
}

/**
 * Sanitize title for filename
 * Remove invalid characters and limit length
 *
 * @param {string} title
 * @returns {string}
 */
function sanitizeTitleForFilename(title) {
  if (!title) return 'untitled'

  // Remove invalid filename characters
  let sanitized = title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '')

  // Replace multiple spaces with single space
  sanitized = sanitized.replace(/\s+/g, ' ').trim()

  // Limit length to 200 characters
  if (sanitized.length > 200) {
    sanitized = sanitized.substring(0, 200).trim()
  }

  return sanitized || 'untitled'
}

/**
 * Format duration from seconds to readable format
 *
 * @param {number} seconds
 * @returns {string}
 */
function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00'

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

module.exports = {
  isValidYouTubeUrl,
  extractVideoId,
  isPlaylistUrl,
  extractPlaylistId,
  sanitizeTitleForFilename,
  formatDuration
}
