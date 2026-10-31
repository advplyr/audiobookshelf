const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  debugLog,
  checkAndMakeDir,
  getTempFilename,
  deleteFile
} = require('./utilities');

module.exports = (options, fieldname, filename) => {
  const dir = path.normalize(options.tempFileDir);
  const tempFilePath = path.join(dir, getTempFilename());
  checkAndMakeDir({ createParentPath: true }, tempFilePath);

  debugLog(options, `Temporary file path is ${tempFilePath}`);
 
  const hash = crypto.createHash('md5');
  let fileSize = 0;
  let completed = false;

  debugLog(options, `Opening write stream for ${fieldname}->${filename}...`);
  const writeStream = fs.createWriteStream(tempFilePath);
  const writePromise = new Promise((resolve, reject) => {
    writeStream.on('finish', () => resolve());
    writeStream.on('error', (err) => {
      debugLog(options, `Error write temp file: ${err}`);
      reject(err);
    });
  });
  // cleanup() can run from an error path and again on response close.
  let cleanedUp = false;

  // Windows cannot unlink while the write stream still holds the file.
  const closeWriteStream = () => new Promise((resolve) => {
    if (writeStream.destroyed || writeStream.closed) {
      return resolve();
    }
    writeStream.once('close', resolve);
    writeStream.once('error', resolve);
    writeStream.end();
  });

  return {
    dataHandler: (data) => {
      if (completed === true) {
        debugLog(options, `Error: got ${fieldname}->${filename} data chunk for completed upload!`);
        return;
      }
      writeStream.write(data);
      hash.update(data);
      fileSize += data.length;
      debugLog(options, `Uploading ${fieldname}->${filename}, bytes:${fileSize}...`);
    },
    getFilePath: () => tempFilePath,
    getFileSize: () => fileSize,
    getHash: () => hash.digest('hex'),
    complete: () => {
      completed = true;
      debugLog(options, `Upload ${fieldname}->${filename} completed, bytes:${fileSize}.`);
      if (writeStream !== false) writeStream.end();
      // Return empty buff since data was uploaded into a temp file.
      return Buffer.concat([]);
    },
    cleanup: () => {
      if (cleanedUp) return Promise.resolve();
      cleanedUp = true;
      completed = true;
      debugLog(options, `Cleaning up temporary file ${tempFilePath}...`);
      return closeWriteStream().then(() => new Promise((resolve) => {
        // ENOENT: handler already mv()'d the file; that is success.
        deleteFile(tempFilePath, err => {
          if (err && err.code !== 'ENOENT') {
            debugLog(options, `Cleaning up temporary file ${tempFilePath} failed: ${err}`);
          } else {
            debugLog(options, `Cleaning up temporary file ${tempFilePath} done.`);
          }
          resolve();
        });
      }));
    },
    getWritePromise: () => writePromise
  };
};
