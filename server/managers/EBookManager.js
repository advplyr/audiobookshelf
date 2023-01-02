const Logger = require('../Logger')
const StreamZip = require('../libs/nodeStreamZip')

const parseEpub = require('../utils/parsers/parseEpub')

class EBookManager {
  constructor() {
    this.extractedEpubs = {}
  }

  async extractBookData(libraryItem, user, isDev = false) {
    if (!libraryItem || !libraryItem.isBook || !libraryItem.media.ebookFile) return null

    if (this.extractedEpubs[libraryItem.id]) return this.extractedEpubs[libraryItem.id]

    const ebookFile = libraryItem.media.ebookFile
    if (!ebookFile.isEpub) {
      Logger.error(`[EBookManager] get book data is not supported for format ${ebookFile.ebookFormat}`)
      return null
    }

    this.extractedEpubs[libraryItem.id] = await parseEpub.parse(ebookFile, libraryItem.id, user.token, isDev)

    return this.extractedEpubs[libraryItem.id]
  }

  async getBookInfo(libraryItem, user, isDev = false) {
    if (!libraryItem || !libraryItem.isBook || !libraryItem.media.ebookFile) return null

    const bookData = await this.extractBookData(libraryItem, user, isDev)

    return {
      title: libraryItem.media.metadata.title,
      pages: bookData.pages.length
    }
  }

  async getBookPage(libraryItem, user, pageIndex, isDev = false) {
    if (!libraryItem || !libraryItem.isBook || !libraryItem.media.ebookFile) return null

    const bookData = await this.extractBookData(libraryItem, user, isDev)

    const pageObj = bookData.pages[pageIndex]

    if (!pageObj) {
      return null
    }

    const parsed = await parseEpub.parsePage(pageObj.path, bookData, libraryItem.id, user.token, isDev)

    if (parsed.error) {
      Logger.error(`[EBookManager] Failed to parse epub page at "${pageObj.path}"`, parsed.error)
      return null
    }

    return parsed.html
  }

  async getBookResource(libraryItem, user, resourcePath, isDev = false, res) {
    if (!libraryItem || !libraryItem.isBook || !libraryItem.media.ebookFile) return res.sendStatus(500)
    const bookData = await this.extractBookData(libraryItem, user, isDev)
    const resourceItem = bookData.resources.find(r => r.path === resourcePath)

    if (!resourceItem) {
      return res.status(404).send('Resource not found')
    }

    const zip = new StreamZip.async({ file: bookData.filepath })
    const stm = await zip.stream(resourceItem.path)

    res.set('content-type', resourceItem['media-type'])

    stm.pipe(res)
    stm.on('end', () => {
      zip.close()
    })
  }

}
module.exports = EBookManager