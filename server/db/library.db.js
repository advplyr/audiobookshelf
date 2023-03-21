const Database = require('../Database')

const getAllLibraries = () => {
  return Database.models.library.findAll({
    include: {
      model: Database.models.librarySetting,
      attributes: ['key', 'value']
    }
  })
}

const getLibrary = (libraryId) => {
  return Database.models.library.findByPk(libraryId, {
    include: {
      model: Database.models.librarySetting,
      attributes: ['key', 'value']
    }
  })
}

module.exports = {
  getAllLibraries,
  getLibrary
}