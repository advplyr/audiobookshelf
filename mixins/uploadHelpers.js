import Path from 'path'

export default {
  data() {
    return {
      uploadHelpers: {
        getItemsFromDrop: this.getItemsFromDataTransferItems,
        getItemsFromPicker: this.getItemsFromFilelist
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
    filterItemFiles(files, mediaType) {
      var validItemFiles = []
      var validOtherFiles = []
      var ignoredFiles = []
      files.forEach((file) => {
        if (!file.filetype) ignoredFiles.push(file)
        else {
          if (file.filetype === 'audio' || (file.filetype === 'ebook' && mediaType === 'book')) validItemFiles.push(file)
          else validOtherFiles.push(file)
        }
      })

      return {
        itemFiles: validItemFiles,
        otherFiles: validOtherFiles,
        ignoredFiles
      }
    },
    itemFromTreeItems(items, mediaType) {
      var { itemFiles, otherFiles, ignoredFiles } = this.filterItemFiles(items, mediaType)
      if (!itemFiles.length) {
        ignoredFiles = ignoredFiles.concat(otherFiles)
        otherFiles = []
      }
      return [
        {
          itemFiles,
          otherFiles,
          ignoredFiles
        }
      ]
    },
    traverseForItem(folder, mediaType, depth = 1) {
      if (folder.items.some((f) => f.isDirectory)) {
        var items = []
        folder.items.forEach((file) => {
          if (file.isDirectory) {
            var itemResults = this.traverseForItem(file, mediaType, ++depth)
            items = items.concat(itemResults)
          }
        })
        return items
      } else {
        return this.itemFromTreeItems(folder.items, mediaType)
      }
    },
    fileTreeToItems(filetree, mediaType) {
      // Has directores - Is Multi Book Drop
      if (filetree.some((f) => f.isDirectory)) {
        var ignoredFilesInRoot = filetree.filter((f) => !f.isDirectory)
        if (ignoredFilesInRoot.length) filetree = filetree.filter((f) => f.isDirectory)

        var itemResults = this.traverseForItem({ items: filetree }, mediaType)
        return {
          items: itemResults,
          ignoredFiles: ignoredFilesInRoot
        }
      } else if (filetree.some((f) => f.filetype !== 'audio') || mediaType !== 'book') {
        // Single Book drop
        return {
          items: this.itemFromTreeItems(filetree, mediaType),
          ignoredFiles: []
        }
      } else {
        // Only audio files dropped so treat each one as an audiobook
        return {
          items: filetree.map((audioFile) => ({ itemFiles: [audioFile], otherFiles: [], ignoredFiles: [] })),
          ignoredFiles: []
        }
      }
    },
    getFilesDropped(dataTransferItems) {
      var treemap = {
        path: '/',
        items: []
      }
      function traverseFileTreePromise(item, currtreemap, checkFileType) {
        return new Promise((resolve) => {
          if (item.isFile) {
            item.file((file) => {
              file.filepath = currtreemap.path + file.name //save full path
              file.filetype = checkFileType(file.name)
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

            let entriesPromises = []
            // readEntries returns 100 items max, continue calling readEntries until empty
            function readEntries() {
              dirReader.readEntries((entries) => {
                if (entries.length > 0) {
                  for (let entr of entries) {
                    entriesPromises.push(traverseFileTreePromise(entr, newtreemap, checkFileType))
                  }
                  readEntries()
                } else {
                  resolve(Promise.all(entriesPromises))
                }
              })
            }
            readEntries()
          }
        })
      }

      return new Promise((resolve, reject) => {
        let entriesPromises = []
        for (let it of dataTransferItems) {
          var filetree = traverseFileTreePromise(it.webkitGetAsEntry(), treemap, this.checkFileType)
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
      var firstBookFile = book.itemFiles[0]
      if (!firstBookFile.filepath) {
        return audiobook // No path
      }

      var firstBookPath = Path.dirname(firstBookFile.filepath)

      var dirs = firstBookPath.split('/').filter((d) => !!d && d !== '.')
      if (dirs.length) {
        audiobook.title = dirs.pop()
        if (dirs.length > 1) {
          audiobook.series = dirs.pop()
        }
        if (dirs.length) {
          audiobook.author = dirs.pop()
        }
      } else {
        // Use file basename as title
        audiobook.title = Path.basename(firstBookFile.name, Path.extname(firstBookFile.name))
      }
      return audiobook
    },
    cleanPodcast(item, index) {
      var podcast = {
        index,
        title: '',
        ...item
      }
      var firstAudioFile = podcast.itemFiles[0]
      if (!firstAudioFile.filepath) return podcast // No path
      var firstPath = Path.dirname(firstAudioFile.filepath)
      var dirs = firstPath.split('/').filter((d) => !!d && d !== '.')
      if (dirs.length) {
        podcast.title = dirs.length > 1 ? dirs[1] : dirs[0]
      } else {
        podcast.title = Path.basename(firstAudioFile.name, Path.extname(firstAudioFile.name))
      }

      return podcast
    },
    cleanItem(item, mediaType, index) {
      if (mediaType === 'podcast') return this.cleanPodcast(item, index)
      return this.cleanBook(item, index)
    },
    async getItemsFromDataTransferItems(dataTransferItems, mediaType) {
      var files = await this.getFilesDropped(dataTransferItems)
      if (!files || !files.length) return { error: 'No files found ' }

      var itemData = this.fileTreeToItems(files, mediaType)
      if (!itemData.items.length && !itemData.ignoredFiles.length) {
        return { error: 'Invalid file drop' }
      }
      var ignoredFiles = itemData.ignoredFiles
      var index = 1
      var items = itemData.items
        .filter((ab) => {
          if (!ab.itemFiles.length) {
            if (ab.otherFiles.length) ignoredFiles = ignoredFiles.concat(ab.otherFiles)
            if (ab.ignoredFiles.length) ignoredFiles = ignoredFiles.concat(ab.ignoredFiles)
          }
          return ab.itemFiles.length
        })
        .map((ab) => this.cleanItem(ab, mediaType, index++))
      return {
        items,
        ignoredFiles
      }
    },
    getItemsFromFilelist(filelist, mediaType) {
      var ignoredFiles = []
      var otherFiles = []

      var itemMap = {}

      filelist.forEach((file) => {
        var filetype = this.checkFileType(file.name)
        if (!filetype) ignoredFiles.push(file)
        else {
          file.filetype = filetype
          if (file.webkitRelativePath) file.filepath = file.webkitRelativePath
          else file.filepath = file.name

          if (filetype === 'audio' || (filetype === 'ebook' && mediaType === 'book')) {
            var dir = file.filepath ? Path.dirname(file.filepath) : ''
            if (dir === '.') dir = ''

            if (!itemMap[dir]) {
              itemMap[dir] = {
                path: dir,
                ignoredFiles: [],
                itemFiles: [],
                otherFiles: []
              }
            }
            itemMap[dir].itemFiles.push(file)
          } else {
            otherFiles.push(file)
          }
        }
      })

      otherFiles.forEach((file) => {
        var dir = Path.dirname(file.filepath)
        var findItem = Object.values(itemMap).find((b) => dir.startsWith(b.path))
        if (findItem) {
          findItem.otherFiles.push(file)
        } else {
          ignoredFiles.push(file)
        }
      })

      var items = []
      var index = 1
      // If book media type and all files are audio files then treat each one as an audiobook
      if (itemMap[''] && !otherFiles.length && mediaType === 'book' && !itemMap[''].itemFiles.some((f) => f.filetype !== 'audio')) {
        items = itemMap[''].itemFiles.map((audioFile) => {
          return this.cleanItem({ itemFiles: [audioFile], otherFiles: [], ignoredFiles: [] }, mediaType, index++)
        })
      } else {
        items = Object.values(itemMap).map((i) => this.cleanItem(i, mediaType, index++))
      }

      return {
        items,
        ignoredFiles: ignoredFiles
      }
    }
  }
}
