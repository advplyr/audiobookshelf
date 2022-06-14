class MediaFileChapterParser {
  static #parseFromMediaFiles(includedAudioFiles) {
    const Logger = require('../../../Logger')
    const Path = require('path')

    if (includedAudioFiles.length === 1) {
      // 1 audio file with chapters
      if (includedAudioFiles[0].chapters) {
        this.chapters = includedAudioFiles[0].chapters.map(c => ({ ...c }))
      }
    } else {
      this.chapters = []
      var currChapterId = 0
      var currStartTime = 0
      includedAudioFiles.forEach((file) => {
        // If audio file has chapters use chapters
        if (file.chapters && file.chapters.length) {
          file.chapters.forEach((chapter) => {
            if (chapter.start > this.duration) {
              Logger.warn(`[Book] Invalid chapter start time > duration`)
            } else {
              var chapterAlreadyExists = this.chapters.find(ch => ch.start === chapter.start)
              if (!chapterAlreadyExists) {
                var chapterDuration = chapter.end - chapter.start
                if (chapterDuration > 0) {
                  var title = `Chapter ${currChapterId}`
                  if (chapter.title) {
                    title += ` (${chapter.title})`
                  }
                  var endTime = Math.min(this.duration, currStartTime + chapterDuration)
                  this.chapters.push({
                    id: currChapterId++,
                    start: currStartTime,
                    end: endTime,
                    title
                  })
                  currStartTime += chapterDuration
                }
              }
            }
          })
        } else if (file.duration) {
          // Otherwise just use track has chapter
          this.chapters.push({
            id: currChapterId++,
            start: currStartTime,
            end: currStartTime + file.duration,
            title: file.metadata.filename ? Path.basename(file.metadata.filename, Path.extname(file.metadata.filename)) : `Chapter ${currChapterId}`
          })
          currStartTime += file.duration
        }
      })
    }

    return this.chapters
  }

  static parse(includedAudioFiles) {
    return MediaFileChapterParser.#parseFromMediaFiles(includedAudioFiles)
  }
}

module.exports = MediaFileChapterParser