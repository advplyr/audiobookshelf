// const express = require('express')
// const EPub = require('epub')
// const Logger = require('./Logger')

// class EbookReader {
//   constructor(db, MetadataPath, AudiobookPath) {
//     this.db = db
//     this.MetadataPath = MetadataPath
//     this.AudiobookPath = AudiobookPath

//     this.router = express()
//     this.init()
//   }

//   init() {
//     this.router.get('/open/:id/:ino', this.openRequest.bind(this))
//   }

//   openRequest(req, res) {
//     Logger.info('Open request received', req.params)
//     var audiobookId = req.params.id
//     var fileIno = req.params.ino
//     var audiobook = this.db.audiobooks.find(ab => ab.id === audiobookId)
//     if (!audiobook) {
//       return res.sendStatus(404)
//     }
//     var ebook = audiobook.ebooks.find(eb => eb.ino === fileIno)
//     if (!ebook) {
//       Logger.error('Ebook file not found', fileIno)
//       return res.sendStatus(404)
//     }
//     Logger.info('Ebook found', ebook)
//     this.open(ebook.fullPath)
//     res.sendStatus(200)
//   }

//   open(path) {
//     var epub = new EPub(path)
//     console.log('epub', epub)
//   }
// }
// module.exports = EbookReader