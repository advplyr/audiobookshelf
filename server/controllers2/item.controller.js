const itemDb = require('../db/item.db')

const getLibraryItem = async (req, res) => {
  let libraryItem = null
  if (req.query.minified == 1) {
    libraryItem = await itemDb.getLibraryItemMinified(req.params.id)
  } else if (req.query.expanded == 1) {
    libraryItem = await itemDb.getLibraryItemExpanded(req.params.id)
  } else {
    libraryItem = await itemDb.getLibraryItemFull(req.params.id)
  }

  res.json(libraryItem)
}

module.exports = {
  getLibraryItem
}