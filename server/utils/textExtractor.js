const StreamZip = require('node-stream-zip')
const { xmlToJSON } = require('./index')
const Path = require('path')
const Logger = require('../Logger')

class TextExtractor {
  /**
   * Extract text content from EPUB file, split by chapters
   * @param {string} epubPath - Path to EPUB file
   * @returns {Promise<Array<{title: string, text: string}>>} Array of chapters
   */
  async extractFromEpub(epubPath) {
    const zip = new StreamZip.async({ file: epubPath })

    try {
      // Read container.xml to find content.opf
      const containerXml = await zip.entryData('META-INF/container.xml')
      const container = await xmlToJSON(containerXml.toString())
      const rootfilePath = container?.container?.rootfiles?.[0]?.rootfile?.[0]?.$?.['full-path']

      if (!rootfilePath) {
        throw new Error('Could not find rootfile in container.xml')
      }

      // Read content.opf
      const opfData = await zip.entryData(rootfilePath)
      const opf = await xmlToJSON(opfData.toString())
      const opfDir = Path.dirname(rootfilePath)

      // Get spine items (reading order)
      const spine = opf?.package?.spine?.[0]?.itemref || []
      const manifest = opf?.package?.manifest?.[0]?.item || []

      // Build manifest map
      const manifestMap = {}
      for (const item of manifest) {
        const attrs = item.$ || item
        if (attrs.id) {
          manifestMap[attrs.id] = attrs
        }
      }

      const chapters = []

      for (const itemref of spine) {
        const idref = itemref.$?.idref || itemref.idref
        const manifestItem = manifestMap[idref]
        if (!manifestItem) continue

        const href = manifestItem.href
        const mediaType = manifestItem['media-type']

        // Only process HTML/XHTML content
        if (!mediaType || (!mediaType.includes('html') && !mediaType.includes('xml'))) {
          continue
        }

        const filePath = opfDir ? Path.join(opfDir, href) : href

        try {
          const content = await zip.entryData(filePath.replace(/\\/g, '/'))
          const text = this.stripHtml(content.toString())

          if (text.trim().length > 0) {
            chapters.push({
              title: `Chapter ${chapters.length + 1}`,
              text: text.trim()
            })
          }
        } catch (err) {
          Logger.warn(`[TextExtractor] Could not read ${filePath}: ${err.message}`)
        }
      }

      return chapters
    } finally {
      await zip.close()
    }
  }

  /**
   * Strip HTML tags and decode entities
   * @param {string} html
   * @returns {string}
   */
  stripHtml(html) {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
  }
}

module.exports = new TextExtractor()
