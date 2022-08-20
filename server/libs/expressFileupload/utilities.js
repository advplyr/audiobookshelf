'use strict';

const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

// Parameters for safe file name parsing.
const SAFE_FILE_NAME_REGEX = /[^\w-]/g;
const MAX_EXTENSION_LENGTH = 3;

// Parameters to generate unique temporary file names:
const TEMP_COUNTER_MAX = 65536;
const TEMP_PREFIX = 'tmp';
let tempCounter = 0;

/**
 * Logs message to console if debug option set to true.
 * @param {Object} options - options object.
 * @param {string} msg - message to log.
 * @returns {boolean} - false if debug is off.
 */
const debugLog = (options, msg) => {
  const opts = options || {};
  if (!opts.debug) return false;
  console.log(`Express-file-upload: ${msg}`); // eslint-disable-line
  return true;
};

/**
 * Generates unique temporary file name. e.g. tmp-5000-156788789789.
 * @param {string} prefix - a prefix for generated unique file name.
 * @returns {string}
 */
const getTempFilename = (prefix = TEMP_PREFIX) => {
  tempCounter = tempCounter >= TEMP_COUNTER_MAX ? 1 : tempCounter + 1;
  return `${prefix}-${tempCounter}-${Date.now()}`;
};

/**
 * isFunc: Checks if argument is a function.
 * @returns {boolean} - Returns true if argument is a function.
 */
const isFunc = func => func && func.constructor && func.call && func.apply ? true: false;

/**
 * Set errorFunc to the same value as successFunc for callback mode.
 * @returns {Function}
 */
const errorFunc = (resolve, reject) => isFunc(reject) ? reject : resolve;

/**
 * Return a callback function for promise resole/reject args.
 * Ensures that callback is called only once.
 * @returns {Function}
 */
const promiseCallback = (resolve, reject) => {
  let hasFired = false;
  return (err) => {
    if (hasFired) {
      return;
    }

    hasFired = true;
    return err ? errorFunc(resolve, reject)(err) : resolve();
  };
};

/**
 * Builds instance options from arguments objects(can't be arrow function).
 * @returns {Object} - result options.
 */
const buildOptions = function() {
  const result = {};
  [...arguments].forEach(options => {
    if (!options || typeof options !== 'object') return;
    Object.keys(options).forEach(i => result[i] = options[i]);
  });
  return result;
};

// The default prototypes for both objects and arrays.
// Used by isSafeFromPollution
const OBJECT_PROTOTYPE_KEYS = Object.getOwnPropertyNames(Object.prototype);
const ARRAY_PROTOTYPE_KEYS = Object.getOwnPropertyNames(Array.prototype);

/**
 * Determines whether a key insertion into an object could result in a prototype pollution
 * @param {Object} base - The object whose insertion we are checking
 * @param {string} key - The key that will be inserted
 */
const isSafeFromPollution = (base, key) => {
  // We perform an instanceof check instead of Array.isArray as the former is more
  // permissive for cases in which the object as an Array prototype but was not constructed
  // via an Array constructor or literal.
  const TOUCHES_ARRAY_PROTOTYPE = (base instanceof Array) && ARRAY_PROTOTYPE_KEYS.includes(key);
  const TOUCHES_OBJECT_PROTOTYPE = OBJECT_PROTOTYPE_KEYS.includes(key);

  return !TOUCHES_ARRAY_PROTOTYPE && !TOUCHES_OBJECT_PROTOTYPE;
};

/**
 * Builds request fields (using to build req.body and req.files)
 * @param {Object} instance - request object.
 * @param {string} field - field name.
 * @param {any} value - field value.
 * @returns {Object}
 */
const buildFields = (instance, field, value) => {
  // Do nothing if value is not set.
  if (value === null || value === undefined) return instance;
  instance = instance || Object.create(null);

  if (!isSafeFromPollution(instance, field)) {
    return instance;
  }
  // Non-array fields
  if (!instance[field]) {
    instance[field] = value;
    return instance;
  }
  // Array fields
  if (instance[field] instanceof Array) {
    instance[field].push(value);
  } else {
    instance[field] = [instance[field], value];
  }
  return instance;
};

/**
 * Creates a folder for file specified in the path variable
 * @param {Object} fileUploadOptions
 * @param {string} filePath
 * @returns {boolean}
 */
const checkAndMakeDir = (fileUploadOptions, filePath) => {
  // Check upload options were set.
  if (!fileUploadOptions) return false;
  if (!fileUploadOptions.createParentPath) return false;
  // Check whether folder for the file exists.
  if (!filePath) return false;
  const parentPath = path.dirname(filePath);
  // Create folder if it doesn't exist.
  if (!fs.existsSync(parentPath)) fs.mkdirSync(parentPath, { recursive: true });
  // Checks folder again and return a results.
  return fs.existsSync(parentPath);
};

/**
 * Deletes a file.
 * @param {string} file - Path to the file to delete.
 * @param {Function} callback
 */
const deleteFile = (file, callback) => fs.unlink(file, callback);

/**
 * Copy file via streams
 * @param {string} src - Path to the source file
 * @param {string} dst - Path to the destination file.
 */
const copyFile = (src, dst, callback) => {
  // cbCalled flag and runCb helps to run cb only once.
  let cbCalled = false;
  let runCb = (err) => {
    if (cbCalled) return;
    cbCalled = true;
    callback(err);
  };
  // Create read stream
  let readable = fs.createReadStream(src);
  readable.on('error', runCb);
  // Create write stream
  let writable = fs.createWriteStream(dst);
  writable.on('error', (err)=>{
    readable.destroy();
    runCb(err);
  });
  writable.on('close', () => runCb());
  // Copy file via piping streams.
  readable.pipe(writable);
};

/**
 * moveFile: moves the file from src to dst.
 * Firstly trying to rename the file if no luck copying it to dst and then deleteing src.
 * @param {string} src - Path to the source file
 * @param {string} dst - Path to the destination file.
 * @param {Function} callback - A callback function.
 */
const moveFile = (src, dst, callback) => fs.rename(src, dst, err => (err
  ? copyFile(src, dst, err => err ? callback(err) : deleteFile(src, callback))
  : callback()
));

/**
 * Save buffer data to a file.
 * @param {Buffer} buffer - buffer to save to a file.
 * @param {string} filePath - path to a file.
 */
const saveBufferToFile = (buffer, filePath, callback) => {
  if (!Buffer.isBuffer(buffer)) {
    return callback(new Error('buffer variable should be type of Buffer!'));
  }
  // Setup readable stream from buffer.
  let streamData = buffer;
  let readStream = Readable();
  readStream._read = () => {
    readStream.push(streamData);
    streamData = null;
  };
  // Setup file system writable stream.
  let fstream = fs.createWriteStream(filePath);
  // console.log("Calling saveBuffer");
  fstream.on('error', err => {
    // console.log("err cb")
    callback(err);
  });
  fstream.on('close', () => {
    // console.log("close cb");
    callback();
  });
  // Copy file via piping streams.
  readStream.pipe(fstream);
};

/**
 * Decodes uriEncoded file names.
 * @param fileName {String} - file name to decode.
 * @returns {String}
 */
const uriDecodeFileName = (opts, fileName) => {
  return opts.uriDecodeFileNames ? decodeURIComponent(fileName) : fileName;
};

/**
 * Parses filename and extension and returns object {name, extension}.
 * @param {boolean|integer} preserveExtension - true/false or number of characters for extension.
 * @param {string} fileName - file name to parse.
 * @returns {Object} - { name, extension }.
 */
const parseFileNameExtension = (preserveExtension, fileName) => {
  const preserveExtensionLength = parseInt(preserveExtension);
  const result = {name: fileName, extension: ''};
  if (!preserveExtension && preserveExtensionLength !== 0) return result;
  // Define maximum extension length
  const maxExtLength = isNaN(preserveExtensionLength)
    ? MAX_EXTENSION_LENGTH
    : Math.abs(preserveExtensionLength);

  const nameParts = fileName.split('.');
  if (nameParts.length < 2) return result;

  let extension = nameParts.pop();
  if (
    extension.length > maxExtLength &&
    maxExtLength > 0
  ) {
    nameParts[nameParts.length - 1] +=
      '.' +
      extension.substr(0, extension.length - maxExtLength);
    extension = extension.substr(-maxExtLength);
  }

  result.extension = maxExtLength ? extension : '';
  result.name = nameParts.join('.');
  return result;
};

/**
 * Parse file name and extension.
 * @param {Object} opts - middleware options.
 * @param {string} fileName - Uploaded file name.
 * @returns {string}
 */
const parseFileName = (opts, fileName) => {
  // Check fileName argument
  if (!fileName || typeof fileName !== 'string') return getTempFilename();
  // Cut off file name if it's lenght more then 255.
  let parsedName = fileName.length <= 255 ? fileName : fileName.substr(0, 255);
  // Decode file name if uriDecodeFileNames option set true.
  parsedName = uriDecodeFileName(opts, parsedName);
  // Stop parsing file name if safeFileNames options hasn't been set.
  if (!opts.safeFileNames) return parsedName;
  // Set regular expression for the file name.
  const nameRegex = typeof opts.safeFileNames === 'object' && opts.safeFileNames instanceof RegExp
    ? opts.safeFileNames
    : SAFE_FILE_NAME_REGEX;
  // Parse file name extension.
  let {name, extension} = parseFileNameExtension(opts.preserveExtension, parsedName);
  if (extension.length) extension = '.' + extension.replace(nameRegex, '');

  return name.replace(nameRegex, '').concat(extension);
};

module.exports = {
  isFunc,
  debugLog,
  copyFile, // For testing purpose.
  moveFile,
  errorFunc,
  deleteFile, // For testing purpose.
  buildFields,
  buildOptions,
  parseFileName,
  getTempFilename,
  promiseCallback,
  checkAndMakeDir,
  saveBufferToFile,
  uriDecodeFileName,
  isSafeFromPollution
};
