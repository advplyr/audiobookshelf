const sharp = require('sharp')
const fs = require('fs')

function resize(filePath, width, height) {
  const readStream = fs.createReadStream(filePath);
  let sharpie = sharp()
  sharpie.toFormat('jpeg')

  if (width || height) {
    sharpie.resize(width, height)
  }

  return readStream.pipe(sharpie)
}

module.exports = resize;