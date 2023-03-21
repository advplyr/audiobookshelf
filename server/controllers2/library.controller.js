const libraryDb = require('../db/library.db')
const itemDb = require('../db/item.db')

const getAllLibraries = async (req, res) => {
  const libraries = await libraryDb.getAllLibraries()
  res.json({
    libraries
  })
}

const getLibrary = async (req, res) => {
  const library = await libraryDb.getLibrary(req.params.id)
  if (!library) return res.sendStatus(404)
  res.json(library)
}

const getLibraryItems = async (req, res) => {
  const libraryItems = await itemDb.getLibraryItemsForLibrary(req.params.id)
  res.json({
    libraryItems
  })
}

module.exports = {
  getAllLibraries,
  getLibrary,
  getLibraryItems
}