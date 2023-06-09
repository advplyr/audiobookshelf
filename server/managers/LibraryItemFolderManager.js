

const fs = require('../libs/fsExtra')

const Logger = require('../Logger')
const LibrarySettings = require('../objects/settings/LibrarySettings')
const fileUtils = require('../utils/fileUtils')


const { getLibraryItemFileData } = require('../utils/scandir')

const LoggerTag = `[LibraryItemFolderManager]`


class LibraryItemFolderManager {
  constructor(db, watcher) {
    this.db = db
    this.watcher = watcher
    this.directorySeperatorChar = '/'
  }
  parseRenameFormat(libraryItem, format, includeTemplateSample) {
    const library = this.db.libraries.find(lib => lib.id === libraryItem.libraryId)
    const folder = library.folders.find(f => f.id === libraryItem.folderId)
    const basePath = fileUtils.filePathToPOSIX(folder.fullPath + this.directorySeperatorChar)
    if (format == "") {
      format = global.ServerSettings.defaultRenameString
    }
    const newRelativeDirectoryRaw = fileUtils.filePathToPOSIX(this.parseTemplateString(format, libraryItem))
    const directorySplit = newRelativeDirectoryRaw.split(this.directorySeperatorChar)
    var newRelativeDirectory = ""
    for (const index in directorySplit) {
      if (directorySplit[index]) { //make sure they dont put a bunch of //// in a row
        const newProposedName = fileUtils.sanitizeFilename(directorySplit[index])
        if (newProposedName) { //make sure there are at least some valid characters
          if (newRelativeDirectory) newRelativeDirectory += this.directorySeperatorChar //add a slash if it is not the first element
          newRelativeDirectory += newProposedName
        }
      }
    }
    var santizedLogString = ""
    if (newRelativeDirectory != newRelativeDirectoryRaw) {
      santizedLogString = ` and then sanitized to ${newRelativeDirectory}`
    }
    Logger.info(`${LoggerTag} ${format} processed to ${newRelativeDirectoryRaw}${santizedLogString}`)

    const newDirectory = basePath + newRelativeDirectory
    const oldRelativeDirectory = libraryItem.relPath
    const oldDirectory = libraryItem.path


    var templateSample = null
    if (includeTemplateSample) {
      templateSample = {
        bookAuthor: fileUtils.sanitizeFilename(this.parseTemplateString("\$bookAuthor", libraryItem)),
        bookTitle: fileUtils.sanitizeFilename(this.parseTemplateString("\$bookTitle", libraryItem)),
        explicit: fileUtils.sanitizeFilename(this.parseTemplateString("\$explicit", libraryItem)),
        subtitle: fileUtils.sanitizeFilename(this.parseTemplateString("\$subtitle", libraryItem)),
        narrator: fileUtils.sanitizeFilename(this.parseTemplateString("\$narrator", libraryItem)),
        genres: fileUtils.sanitizeFilename(this.parseTemplateString("\$genres", libraryItem)),
        publishedYear: fileUtils.sanitizeFilename(this.parseTemplateString("\$publishedYear", libraryItem)),
        publishedDate: fileUtils.sanitizeFilename(this.parseTemplateString("\$publishedDate", libraryItem)),
        publisher: fileUtils.sanitizeFilename(this.parseTemplateString("\$publisher", libraryItem)),
        isbn: fileUtils.sanitizeFilename(this.parseTemplateString("\$isbn", libraryItem)),
        asin: fileUtils.sanitizeFilename(this.parseTemplateString("\$asin", libraryItem)),
        language: fileUtils.sanitizeFilename(this.parseTemplateString("\$language", libraryItem)),
        seriesSummary: fileUtils.sanitizeFilename(this.parseTemplateString("\$seriesSummary", libraryItem)),
        seriesName: fileUtils.sanitizeFilename(this.parseTemplateString("\$seriesName", libraryItem)),
        seriesNamelbr0rbr: fileUtils.sanitizeFilename(this.parseTemplateString("\$seriesName[0]", libraryItem)),
        seriesSequence: fileUtils.sanitizeFilename(this.parseTemplateString("\$seriesSequence", libraryItem)),
        seriesSequencelbr0rbr: fileUtils.sanitizeFilename(this.parseTemplateString("\$seriesSequence[0]", libraryItem))
      }
    }

    return {
      basePath: basePath,
      newRelativeDirectory: newRelativeDirectory,
      newDirectory: newDirectory,
      oldRelativeDirectory: oldRelativeDirectory,
      oldDirectory: oldDirectory,
      formatUsed: format,
      directorySeperatorChar: this.directorySeperatorChar,
      templateSample: templateSample
    }
  }
  async startRenameBookFolder(libraryItem, format) {
    Logger.info(`${LoggerTag} Start rename for ${libraryItem.id}`)
    const newPaths = this.parseRenameFormat(libraryItem, format)
    const basePath = newPaths.basePath
    const newRelativeDirectory = newPaths.newRelativeDirectory
    const newDirectory = newPaths.newDirectory
    const oldRelativeDirectory = newPaths.oldRelativeDirectory
    const oldDirectory = newPaths.oldDirectory

    if (newDirectory === oldDirectory) {
      Logger.info(`${LoggerTag} New folder (${newDirectory}) equal to current folder(${oldDirectory}), aborting rename`)
      return {
        msg: "Folder not Renamed",
        success: false,
        details: `New folder (${newDirectory}) equal to current folder(${oldDirectory}), aborting rename`
      }
    }

    //TODO - Check if target directory is a sub-directory of another book, fail if so.

    Logger.info(`${LoggerTag} Renaming ${oldDirectory} to ${newDirectory}`)
    this.watcher.addIgnoreDir(oldDirectory)
    this.watcher.addIgnoreDir(newDirectory)
    if (!await fs.pathExists(newDirectory)) {

      const li = this.db.libraryItems.find(li => newDirectory.startsWith(li.path))
      if (li) {
        return {
          msg: "Folder is sub path of another book",
          success: false,
          details: `The path you are trying to move to ${newDirectory} is a sub-directory of another book - ${li.media.metadata.title}(${li.id}) stored in ${li.path}`,
        }
      }

      var moveStatus = await fs.move(oldDirectory, newDirectory, { overwrite: false }).catch((err) => {
        return err
      })
      if (moveStatus != null) {
        Logger.error(`${LoggerTag} Failed folder rename ${moveStatus}`)
        return {
          msg: "Failed to move folder",
          success: false,
          details: `${moveStatus}`
        }
      } else {
        //move Success, check subfolders if empty and then remove.
        var currentCheckingRelDirectory = oldRelativeDirectory
        if (currentCheckingRelDirectory.endsWith(this.directorySeperatorChar)) currentCheckingRelDirectory = currentCheckingRelDirectory.substring(0, currentCheckingRelDirectory.length - 1)
        const dirParts = currentCheckingRelDirectory.split(this.directorySeperatorChar)
        for (var i = dirParts.length - 1; i >= 0; i--) {
          currentCheckingRelDirectory = currentCheckingRelDirectory.substring(0, currentCheckingRelDirectory.length - dirParts[i].length - 1)
          var currentCheckingDirectory = basePath + currentCheckingRelDirectory
          if (currentCheckingRelDirectory) {
            var fileItems = await fileUtils.recurseFiles(currentCheckingDirectory) //this will find files nested in subdirectories as well.
            if (fileItems && fileItems.length == 0) {
              Logger.debug(`${LoggerTag} no files in sub folders, safe to delete '${currentCheckingRelDirectory}'`)
              fileUtils.removeFile(currentCheckingDirectory)
            } else {
              break; //if we do find a file, then no need to check parent dirs they will all have files in subfolders.
            }
          }
        }
      }
    }
    else {
      Logger.error(`${LoggerTag} target folder ${newDirectory} already exists.  Cancelling move`)
      return { msg: "failed to move folder", success: false, details: `target folder ${newDirectory} already exists.  Cancelling move` }
    }
    Logger.debug(`${LoggerTag} dynamically updating all path variables in Library Item from ${oldRelativeDirectory} to ${newRelativeDirectory}`)
    this.recursiveUpdatePath(libraryItem, libraryItem.toJSON(), oldRelativeDirectory, newRelativeDirectory, basePath)
    await this.db.updateLibraryItem(libraryItem)
    const libItem = this.db.getLibraryItem(libraryItem.id)


    //you have to put the removal of the ignore on a delay for long enough that the Watcher process
    //will have checkd on the directory, recognized it should be ignored, before removing the ignore process
    setTimeout(() => {
      this.watcher.removeIgnoreDir(oldDirectory)
      this.watcher.removeIgnoreDir(newDirectory)
    }, this.watcher.pendingDelay)


    Logger.info(`${LoggerTag} rename successful.`)
    return {
      msg: "Rename Success",
      success: true,
      details: newPaths
      //, testObj: testObj
    }

  }
  recursiveUpdatePath(item, json, oldRelPath, newRelPath, basePath) {
    for (const key in json) {
      if (key.toLowerCase().includes("path")) {
        if (item[key] == basePath + oldRelPath) {
          item[key] = basePath + newRelPath
        }
        else if (item[key] == oldRelPath) {
          item[key] = newRelPath
        }
        else if (item[key].startsWith(oldRelPath + this.directorySeperatorChar)) {
          item[key] = item[key].replace(oldRelPath + this.directorySeperatorChar, newRelPath + this.directorySeperatorChar)
        }
        else if (item[key].startsWith(basePath + oldRelPath + this.directorySeperatorChar)) {
          item[key] = item[key].replace(basePath + oldRelPath + this.directorySeperatorChar, basePath + newRelPath + this.directorySeperatorChar)
        }
      }
      if (typeof json[key] === "object") {
        this.recursiveUpdatePath(item[key], json[key], oldRelPath, newRelPath, basePath)
      }
    }
  }

  sanitizeText(str) {
    if (str) {
      return fileUtils.sanitizeFilename(str)
    }
    else {
      return ""
    }
  }
  parseTemplateString(userTemplate, libraryItem) {
    var template = userTemplate ? userTemplate : global.ServerSettings.defaultRenameString

    var bookTitle = this.sanitizeText(libraryItem.media.metadata.title)
    var bookAuthor = this.sanitizeText(libraryItem.media.metadata.authorName)
    var subtitle = this.sanitizeText(libraryItem.media.metadata.subtitle)
    //series
    var narrator = this.sanitizeText(libraryItem.media.metadata.narratorName)
    var genres = this.sanitizeText(libraryItem.media.metadata.genresDisplay)
    var publishedYear = this.sanitizeText(libraryItem.media.metadata.publishedYear)
    var publishedDate = this.sanitizeText(libraryItem.media.metadata.publishedDate)
    var publisher = this.sanitizeText(libraryItem.media.metadata.publisher)
    var isbn = this.sanitizeText(libraryItem.media.metadata.isbn)
    var asin = this.sanitizeText(libraryItem.media.metadata.asin)
    var language = this.sanitizeText(libraryItem.media.metadata.language)
    var explicit = this.sanitizeText(libraryItem.media.metadata.explicitDisplay)
    var seriesSummary = this.sanitizeText(libraryItem.media.metadata.seriesName)
    var output = template
    while (output.includes("\$bookTitle")) output = output.replace("\$bookTitle", bookTitle)
    while (output.includes("\$bookAuthor")) output = output.replace("\$bookAuthor", bookAuthor)
    while (output.includes("\$subtitle")) output = output.replace("\$subtitle", subtitle)
    while (output.includes("\$narrator")) output = output.replace("\$narrator", narrator)
    while (output.includes("\$genres")) output = output.replace("\$genres", genres)
    while (output.includes("\$publishedYear")) output = output.replace("\$publishedYear", publishedYear)
    while (output.includes("\$publishedDate")) output = output.replace("\$publishedDate", publishedDate)
    while (output.includes("\$publisher")) output = output.replace("\$publisher", publisher)
    while (output.includes("\$isbn")) output = output.replace("\$isbn", isbn)
    while (output.includes("\$asin")) output = output.replace("\$asin", asin)
    while (output.includes("\$language")) output = output.replace("\$language", language)
    while (output.includes("\$explicit")) output = output.replace("\$explicit", explicit)
    while (output.includes("\$seriesSummary")) output = output.replace("\$seriesSummary", seriesSummary)

    var seriesNameRegex = /\$seriesName\[\d+\]/
    while (output.match(seriesNameRegex) != null) {
      var subString = output.match(seriesNameRegex)[0]
      if (subString != null) {
        var digitStr = subString.replace("\$seriesName[", "").replace("]", "")
        var digit = parseInt(digitStr)
        var replacementText = this.sanitizeText(libraryItem.media.metadata.getSeriesNameDisplay(digit))
        output = output.replace(subString, replacementText)
      }
    }
    while (output.includes("\$seriesName")) output = output.replace("\$seriesName", this.sanitizeText(libraryItem.media.metadata.getSeriesNameDisplay(0)))

    var seriesSeqRegex = /\$seriesSequence\[\d+\]/
    while (output.match(seriesSeqRegex) != null) {
      var subString = output.match(seriesSeqRegex)[0]
      if (subString != null) {
        var digitStr = subString.replace("\$seriesSequence[", "").replace("]", "")
        var digit = parseInt(digitStr)
        var replacementText = this.sanitizeText(libraryItem.media.metadata.getSeriesSequenceDisplay(digit))
        output = output.replace(subString, replacementText)
      }
    }
    while (output.includes("\$seriesSequence")) output = output.replace("\$seriesSequence", this.sanitizeText(libraryItem.media.metadata.getSeriesSequenceDisplay(0)))

    return output
  }

}
module.exports = LibraryItemFolderManager
