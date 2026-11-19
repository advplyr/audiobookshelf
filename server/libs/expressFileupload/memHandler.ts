import { createHash } from 'node:crypto';
import utilities from './utilities';

const { debugLog } = utilities;

/**
 * memHandler - In memory upload handler
 * @param {Object} options
 * @param {String} fieldname
 * @param {String} filename
 * @returns {Object}
 */
export = (options: Parameters<typeof debugLog>[0], fieldname: string, filename: string) => {
  const buffers: Buffer[] = [];
  const hash = createHash('md5');
  let fileSize = 0;
  let completed = false;

  const getBuffer = () => Buffer.concat(buffers, fileSize);

  return {
    dataHandler: (data: Buffer) => {
      if (completed === true) {
        debugLog(options, `Error: got ${fieldname}->${filename} data chunk for completed upload!`);
        return;
      }
      buffers.push(data);
      hash.update(data);
      fileSize += data.length;
      debugLog(options, `Uploading ${fieldname}->${filename}, bytes:${fileSize}...`);
    },
    getBuffer: getBuffer,
    getFilePath: () => '',
    getFileSize: () => fileSize,
    getHash: () => hash.digest('hex'),
    complete: () => {
      debugLog(options, `Upload ${fieldname}->${filename} completed, bytes:${fileSize}.`);
      completed = true;
      return getBuffer();
    },
    cleanup: () => { completed = true; },
    getWritePromise: () => Promise.resolve()
  };
};
