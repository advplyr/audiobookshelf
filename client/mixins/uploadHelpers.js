import Path from 'path'

export default {
  data() {
    return {
      uploadHelpers: {
        getBooksFromDrop: this.getBooksFromDataTransferItems,
        getBooksFromPicker: this.getBooksFromFileList
      }
    }
  },
  methods: {
    checkFileType(filename) {
      var ext = Path.extname(filename)
      if (!ext) return false
      if (ext.startsWith('.')) ext = ext.slice(1)
      ext = ext.toLowerCase()

      for (const filetype in this.$constants.SupportedFileTypes) {
        if (this.$constants.SupportedFileTypes[filetype].includes(ext)) {
          return filetype
        }
      }
      return false
    },
    filterAudiobookFiles(files) {
      var validBookFiles = []
      var validOtherFiles = []
      var ignoredFiles = []
      files.forEach((file) => {
        var filetype = this.checkFileType(file.name)
        if (!filetype) ignoredFiles.push(file)
        else {
          file.filetype = filetype
          if (filetype === 'audio' || filetype === 'ebook') validBookFiles.push(file)
          else validOtherFiles.push(file)
        }
      })

      return {
        bookFiles: validBookFiles,
        otherFiles: validOtherFiles,
        ignoredFiles
      }
    },
    audiobookFromItems(items) {
      var { bookFiles, otherFiles, ignoredFiles } = this.filterAudiobookFiles(items)
      if (!bookFiles.length) {
        ignoredFiles = ignoredFiles.concat(otherFiles)
        otherFiles = []
      }
      return [
        {
          bookFiles,
          otherFiles,
          ignoredFiles
        }
      ]
    },
    traverseForAudiobook(folder, depth = 1) {
      if (folder.items.some((f) => f.isDirectory)) {
        var audiobooks = []
        folder.items.forEach((file) => {
          if (file.isDirectory) {
            var audiobookResults = this.traverseForAudiobook(file, ++depth)
            audiobooks = audiobooks.concat(audiobookResults)
          }
        })
        return audiobooks
      } else {
        return this.audiobookFromItems(folder.items)
      }
    },
    fileTreeToAudiobooks(filetree) {
      // Has directores - Is Multi Book Drop
      if (filetree.some((f) => f.isDirectory)) {
        var ignoredFilesInRoot = filetree.filter((f) => !f.isDirectory)
        if (ignoredFilesInRoot.length) filetree = filetree.filter((f) => f.isDirectory)

        var audiobookResults = this.traverseForAudiobook({ items: filetree })
        return {
          audiobooks: audiobookResults,
          ignoredFiles: ignoredFilesInRoot
        }
      } else {
        // Single Book drop
        return {
          audiobooks: this.audiobookFromItems(filetree),
          ignoredFiles: []
        }
      }
    },
    getFilesDropped(dataTransferItems) {
      var treemap = {
        path: '/',
        items: []
      }
      function traverseFileTreePromise(item, currtreemap) {
        return new Promise((resolve) => {
          if (item.isFile) {
            item.file((file) => {
              file.filepath = currtreemap.path + file.name //save full path
              currtreemap.items.push(file)
              resolve(file)
            })
          } else if (item.isDirectory) {
            let dirReader = item.createReader()
            currtreemap.items.push({
              isDirectory: true,
              dirname: item.name,
              path: currtreemap.path + item.name + '/',
              items: []
            })
            var newtreemap = currtreemap.items[currtreemap.items.length - 1]
            dirReader.readEntries((entries) => {
              let entriesPromises = []
              for (let entr of entries) entriesPromises.push(traverseFileTreePromise(entr, newtreemap))
              resolve(Promise.all(entriesPromises))
            })
          }
        })
      }

      return new Promise((resolve, reject) => {
        let entriesPromises = []
        for (let it of dataTransferItems) {
          var filetree = traverseFileTreePromise(it.webkitGetAsEntry(), treemap)
          entriesPromises.push(filetree)
        }
        Promise.all(entriesPromises).then(() => {
          resolve(treemap.items)
        })
      })
    },
    cleanBook(book, index) {
      var audiobook = {
        index,
        title: '',
        author: '',
        series: '',
        ...book
      }
      var firstBookFile = book.bookFiles[0]
      if (!firstBookFile.filepath) return audiobook // No path

      var firstBookPath = Path.dirname(firstBookFile.filepath)

      var dirs = firstBookPath.split('/').filter(d => !!d && d !== '.')
      if (dirs.length) {
        audiobook.title = dirs.pop()
        if (dirs.length > 1) {
          audiobook.series = dirs.pop()
        }
        if (dirs.length) {
          audiobook.author = dirs.pop()
        }
      }
      return audiobook
    },
    async getBooksFromDataTransferItems(items) {
      var files = await this.getFilesDropped(items)
      if (!files || !files.length) return { error: 'No files found ' }
      var audiobooksData = this.fileTreeToAudiobooks(files)
      if (!audiobooksData.audiobooks.length && !audiobooksData.ignoredFiles.length) {
        return { error: 'Invalid file drop' }
      }
      var ignoredFiles = audiobooksData.ignoredFiles
      var index = 1
      var books = audiobooksData.audiobooks.filter((ab) => {
        if (!ab.bookFiles.length) {
          if (ab.otherFiles.length) ignoredFiles = ignoredFiles.concat(ab.otherFiles)
          if (ab.ignoredFiles.length) ignoredFiles = ignoredFiles.concat(ab.ignoredFiles)
        }
        return ab.bookFiles.length
      }).map(ab => this.cleanBook(ab, index++))
      return {
        books,
        invalidBooks,
        ignoredFiles
      }
    },
    getBooksFromFileList(filelist) {
      var ignoredFiles = []
      var otherFiles = []

      var bookMap = {}

      filelist.forEach((file) => {
        var filetype = this.checkFileType(file.name)
        if (!filetype) ignoredFiles.push(file)
        else {
          file.filetype = filetype
          if (file.webkitRelativePath) file.filepath = file.webkitRelativePath

          if (filetype === 'audio' || filetype === 'ebook') {
            var dir = file.filepath ? Path.dirname(file.filepath) : ''
            if (!bookMap[dir]) {
              bookMap[dir] = {
                path: dir,
                ignoredFiles: [],
                bookFiles: [],
                otherFiles: []
              }
            }
            bookMap[dir].bookFiles.push(file)
          } else {
            otherFiles.push(file)
          }
        }
      })

      otherFiles.forEach((file) => {
        var dir = Path.dirname(file.filepath)
        var findBook = Object.values(bookMap).find(b => dir.startsWith(b.path))
        if (findBook) {
          bookMap[dir].otherFiles.push(file)
        } else {
          ignoredFiles.push(file)
        }
      })

      var index = 1
      var books = Object.values(bookMap).map(ab => this.cleanBook(ab, index++))
      return {
        books,
        ignoredFiles: ignoredFiles
      }
    },
  }
}