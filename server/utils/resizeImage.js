const sharp = require('sharp')
const fs = require('fs')

function resize(filePath, width, height, format = 'webp') {
  const readStream = fs.createReadStream(filePath);
  let sharpie = sharp()
  sharpie.toFormat(format)

  if (width || height) {
    sharpie.resize(width, height, { withoutEnlargement: true })
  }

  return readStream.pipe(sharpie)
}

module.exports = resize;