const EBookFile = require('../files/EBookFile')
const { areEquivalent, copyValue, getId } = require('../../utils/index')

class EBook {
  constructor(ebook) {
    this.id = null
    this.index = null
    this.name = null
    this.ebookFile = null
    this.addedAt = null
    this.updatedAt = null

    if (ebook) {
      this.construct(ebook)
    }
  }

  construct(ebook) {
    this.id = ebook.id
    this.index = ebook.index
    this.name = ebook.name
    this.ebookFile = new EBookFile(ebook.ebookFile)
    this.addedAt = ebook.addedAt
    this.updatedAt = ebook.updatedAt
  }

  toJSON() {
    return {
      id: this.id,
      index: this.index,
      name: this.name,
      ebookFile: this.ebookFile.toJSON(),
      addedAt: this.addedAt,
      updatedAt: this.updatedAt
    }
  }

  toJSONMinified() {
    return {
      id: this.id,
      index: this.index,
      name: this.name,
      ebookFormat: this.ebookFile.ebookFormat,
      addedAt: this.addedAt,
      updatedAt: this.updatedAt,
      size: this.size
    }
  }

  toJSONExpanded() {
    return {
      id: this.id,
      index: this.index,
      name: this.name,
      ebookFile: this.ebookFile.toJSON(),
      addedAt: this.addedAt,
      updatedAt: this.updatedAt,
      size: this.size
    }
  }

  get isPlaybackMediaEntity() { return false }
  get size() {
    return this.ebookFile.metadata.size
  }

  setData(ebookFile, index) {
    this.id = getId('eb')
    this.name = ebookFile.metadata.filename
    this.index = index
    this.ebookFile = ebookFile
    this.addedAt = Date.now()
    this.updatedAt = Date.now()
  }

  findFileWithInode(inode) {
    return this.ebookFile.ino === inode
  }
}
module.exports = EBook