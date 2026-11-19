import utilities from './utilities';

interface FileOptions {
  name: string;
  buffer: Buffer;
  size: number;
  encoding: string;
  tempFilePath: string;
  truncated: boolean;
  mimetype: string;
  hash: string;
}

interface UploadOptions {
  debug?: boolean;
  useTempFiles?: boolean;
  createParentPath?: boolean;
}

type MoveCallback = Parameters<typeof utilities.promiseCallback>[0];

const {
  isFunc,
  debugLog,
  moveFile,
  promiseCallback,
  checkAndMakeDir,
  saveBufferToFile
} = utilities;

/**
 * Returns Local function that moves the file to a different location on the filesystem
 * which takes two function arguments to make it compatible w/ Promise or Callback APIs
 * @param {String} filePath - destination file path.
 * @param {Object} options - file factory options.
 * @param {Object} fileUploadOptions - middleware options.
 * @returns {Function}
 */
const moveFromTemp = (filePath: string, options: FileOptions, fileUploadOptions: UploadOptions) => (resolve: MoveCallback, reject?: MoveCallback) => {
  debugLog(fileUploadOptions, `Moving temporary file ${options.tempFilePath} to ${filePath}`);
  moveFile(options.tempFilePath, filePath, promiseCallback(resolve, reject));
};

/**
 * Returns Local function that moves the file from buffer to a different location on the filesystem
 * which takes two function arguments to make it compatible w/ Promise or Callback APIs
 * @param {String} filePath - destination file path.
 * @param {Object} options - file factory options.
 * @param {Object} fileUploadOptions - middleware options.
 * @returns {Function}
 */
const moveFromBuffer = (filePath: string, options: FileOptions, fileUploadOptions: UploadOptions) => (resolve: MoveCallback, reject?: MoveCallback) => {
  debugLog(fileUploadOptions, `Moving uploaded buffer to ${filePath}`);
  saveBufferToFile(options.buffer, filePath, promiseCallback(resolve, reject));
};

export = (options: FileOptions, fileUploadOptions: UploadOptions = {}) => {
  // see: https://github.com/richardgirges/express-fileupload/issues/14
  // firefox uploads empty file in case of cache miss when f5ing page.
  // resulting in unexpected behavior. if there is no file data, the file is invalid.
  // if (!fileUploadOptions.useTempFiles && !options.buffer.length) return;
  
  // Create and return file object.
  return {
    name: options.name,
    data: options.buffer,
    size: options.size,
    encoding: options.encoding,
    tempFilePath: options.tempFilePath,
    truncated: options.truncated,
    mimetype: options.mimetype,
    md5: options.hash,
    mv: (filePath: string, callback?: MoveCallback) => {
      // Define a propper move function.
      const moveFunc = fileUploadOptions.useTempFiles
        ? moveFromTemp(filePath, options, fileUploadOptions)
        : moveFromBuffer(filePath, options, fileUploadOptions);
      // Create a folder for a file.
      checkAndMakeDir(fileUploadOptions, filePath);
      // If callback is passed in, use the callback API, otherwise return a promise.
      return isFunc(callback) ? moveFunc(callback) : new Promise<void>((resolve, reject) => moveFunc(() => resolve(), reject));
    }
  };
};
