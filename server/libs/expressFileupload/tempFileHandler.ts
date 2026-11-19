import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import type { WriteStream } from 'node:fs';
import path from 'node:path';
import utilities from './utilities';

interface TempFileOptions {
  tempFileDir: string;
  debug?: boolean;
}

const {
  debugLog,
  checkAndMakeDir,
  getTempFilename,
  deleteFile
} = utilities;

export = (options: TempFileOptions, fieldname: string, filename: string) => {
  const dir = path.normalize(options.tempFileDir);
  const tempFilePath = path.join(dir, getTempFilename());
  checkAndMakeDir({ createParentPath: true }, tempFilePath);

  debugLog(options, `Temporary file path is ${tempFilePath}`);

  const hash = createHash('md5');
  let fileSize = 0;
  let completed = false;

  debugLog(options, `Opening write stream for ${fieldname}->${filename}...`);
  const writeStream = createWriteStream(tempFilePath);
  const writePromise = new Promise<void>((resolve, reject) => {
    writeStream.on('finish', () => resolve());
    writeStream.on('error', (err) => {
      debugLog(options, `Error write temp file: ${err}`);
      reject(err);
    });
  });

  return {
    dataHandler: (data: Buffer) => {
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
      if ((writeStream as WriteStream | false) !== false) writeStream.end();
      // Return empty buff since data was uploaded into a temp file.
      return Buffer.concat([]);
    },
    cleanup: () => {
      completed = true;
      debugLog(options, `Cleaning up temporary file ${tempFilePath}...`);
      writeStream.end();
      deleteFile(tempFilePath, err => (err
        ? debugLog(options, `Cleaning up temporary file ${tempFilePath} failed: ${err}`)
        : debugLog(options, `Cleaning up temporary file ${tempFilePath} done.`)
      ));
    },
    getWritePromise: () => writePromise
  };
};
