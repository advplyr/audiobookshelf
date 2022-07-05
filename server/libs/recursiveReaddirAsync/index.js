"use strict";
/**
 * @packageDocumentation
 * project: recursive-readdir-async
 * @author: m0rtadelo (ricard.figuls)
 * @license MIT
 * 2018
 */

// SOURCE: https://github.com/m0rtadelo/recursive-readdir-async

var __createBinding = (this && this.__createBinding) || (Object.create ? (function (o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  Object.defineProperty(o, k2, { enumerable: true, get: function () { return m[k]; } });
}) : (function (o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function (o, v) {
  Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function (o, v) {
  o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
  if (mod && mod.__esModule) return mod;
  var result = {};
  if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
  __setModuleDefault(result, mod);
  return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
  function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
  return new (P || (P = Promise))(function (resolve, reject) {
    function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
    function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
    function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.list = exports.readFile = exports.stat = exports.PATH = exports.FS = exports.TREE = exports.LIST = void 0;
/** @readonly constant for mode LIST to be used in Options */
exports.LIST = 1;
/** @readonly constant for mode TREE to be used in Options */
exports.TREE = 2;
/**
 * native FS module
 * @see https://nodejs.org/api/fs.html#fs_file_system
 * @external
 */
const _fs = __importStar(require("fs"));
/** native node fs object */
exports.FS = _fs;
/**
 * native PATH module
 * @external
 * @see https://nodejs.org/api/path.html#path_path
 */
const _path = __importStar(require("path"));
/** native node path object */
exports.PATH = _path;
let pathSimbol = '/';
/**
 * Returns a Promise with Stats info of the item (file/folder/...)
 * @param file the name of the object to get stats from
 * @returns {Promise<fs.Stats>} stat object information
 * @async
 */
function stat(file) {
  return __awaiter(this, void 0, void 0, function* () {
    return new Promise(function (resolve, reject) {
      exports.FS.stat(file, function (err, stats) {
        if (err) {
          reject(err);
        }
        else {
          resolve(stats);
        }
      });
    });
  });
}
exports.stat = stat;
/**
 * Returns a Promise with content (data) of the file
 * @param file the name of the file to read content from
 * @param encoding format for returned data (ascii, base64, binary, hex, ucs2/ucs-2/utf16le/utf-16le,
 *  utf8/utf-8, latin1). Default: base64
 * @returns {Promise<string>} data content string (base64 format by default)
 * @async
 */
function readFile(file, encoding = 'base64') {
  return __awaiter(this, void 0, void 0, function* () {
    return new Promise(function (resolve, reject) {
      exports.FS.readFile(file, { encoding }, function (err, data) {
        if (err) {
          reject(err);
        }
        else {
          resolve(data);
        }
      });
    });
  });
}
exports.readFile = readFile;
/**
 * Returns if an item should be added based on include/exclude options.
 * @param path the item fullpath
 * @param settings the options configuration to use
 * @returns {boolean} if item must be added
 * @private
 */
function checkItem(path, settings) {
  if (settings.exclude) {
    for (const value of settings.exclude) {
      if (path.includes(value)) {
        return false;
      }
    }
  }
  return true;
}
/**
 * Adds optional keys to item
 * @param obj the item object
 * @param file the filename
 * @param settings the options configuration to use
 * @param deep The deep level
 * @returns void
 * @private
 */
function addOptionalKeys(obj, file, settings, deep) {
  if (settings.extensions) {
    obj.extension = (exports.PATH.extname(file)).toLowerCase();
  }
  if (settings.deep) {
    obj.deep = deep;
  }
}
/**
 * Reads content and creates a valid IBase collection
 * @param rpath Path relative to
 * @param data Model
 * @param settings the options configuration to use
 * @param deep The deep level
 * @param resolve Promise
 * @param reject Promise
 * @returns void
 */
function read(rpath, data, settings, deep, resolve, reject) {
  exports.FS.readdir(rpath, function (error, files) {
    // If error reject them
    if (error) {
      reject(error);
    }
    else {
      const removeExt = (file) => {
        const extSize = exports.PATH.extname(file).length;
        return file.substring(0, file.length - (extSize > 0 ? extSize : 0));
      };
      // Iterate through elements (files and folders)
      for (const file of files) {
        const obj = {
          name: file,
          title: removeExt(file),
          path: rpath,
          fullname: rpath + (rpath.endsWith(pathSimbol) ? '' : pathSimbol) + file,
        };
        if (checkItem(obj.fullname, settings)) {
          addOptionalKeys(obj, file, settings, deep);
          data.push(obj);
        }
      }
      // Finish, returning content
      resolve(data);
    }
  });
}
/**
 * Returns a Promise with an objects info array
 * @param path the item fullpath to be searched for
 * @param settings the options configuration to use
 * @param deep folder depth value
 * @returns {Promise<IBase[]>} the file object info
 * @private
 */
function myReaddir(path, settings, deep) {
  return __awaiter(this, void 0, void 0, function* () {
    const data = [];
    return new Promise(function (resolve, reject) {
      try {
        // Asynchronously computes the canonical pathname by resolving ., .. and symbolic links.
        exports.FS.realpath(path, function (err, rpath) {
          if (err || settings.realPath === false) {
            rpath = path;
          }
          // Normalizes windows style paths by replacing double backslahes with single forward slahes (unix style).
          if (settings.normalizePath) {
            rpath = normalizePath(rpath);
          }
          // Reading contents of path
          read(rpath, data, settings, deep, resolve, reject);
        });
      }
      catch (err) {
        // If error reject them
        reject(err);
      }
    });
  });
}
/**
 * Normalizes windows style paths by replacing double backslahes with single forward slahes (unix style).
 * @param path windows/unix path
 * @return {string} normalized path (unix style)
 * @private
 */
function normalizePath(path) {
  return path.toString().replace(/\\/g, '/');
}
/**
     * Search if the fullname exist in the include array
     * @param fullname - The fullname of the item to search for
     * @param settings the options to be used
     * @returns true if exists
     */
function exists(fullname, settings) {
  if (settings.include) {
    for (const value of settings.include) {
      if (fullname.includes(value)) {
        return true;
      }
    }
  }
  return false;
}
/**
   * Removes paths that not match the include array
   * @param settings the options to be used
   * @param content items list
   * @returns void
   */
function onlyInclude(settings, content) {
  if (settings.include && settings.include.length > 0) {
    for (let i = content.length - 1; i > -1; i--) {
      const item = content[i];
      if (settings.mode === exports.TREE && item.isDirectory && item.content)
        continue;
      if (!exists(item.fullname, settings)) {
        content.splice(i, 1);
      }
    }
  }
}
/**
 * Returns an array of items in path
 * @param path path
 * @param settings the options to be used
 * @param progress callback progress
 * @param deep deep index information
 * @returns {object[]} array with file information
 * @private
 */
function listDir(path, settings, progress, deep = 0) {
  return __awaiter(this, void 0, void 0, function* () {
    let content;
    try {
      content = yield myReaddir(path, settings, deep);
    }
    catch (err) {
      return { 'error': err, 'path': path };
    }
    if (settings.stats || settings.recursive || !settings.ignoreFolders ||
      settings.readContent || settings.mode === exports.TREE) {
      content = yield statDir(content, settings, progress, deep);
    }
    onlyInclude(settings, content);
    return content;
  });
}
/**
 * Returns an object with all items with selected options
 * @param collection items list
 * @param settings the options to use
 * @param progress callback progress
 * @param deep folder depth
 * @returns {object[]} array with file information
 * @private
 */
function statDir(collection, settings, progress, deep) {
  return __awaiter(this, void 0, void 0, function* () {
    let isOk = true;
    for (let i = collection.length - 1; i > -1; i--) {
      try {
        collection = yield statDirItem(collection, i, settings, progress, deep);
        if (progress !== undefined) {
          isOk = !progress(collection[i], collection.length - i, collection.length);
        }
      }
      catch (err) {
        collection[i].error = err;
      }
      if ((collection[i].isDirectory && settings.ignoreFolders &&
        !(collection[i].content) && collection[i].error === undefined) || !isOk) {
        collection.splice(i, 1);
      }
    }
    return collection;
  });
}
/**
 * Returns an object with updated item information
 * @param collection items list
 * @param i index of item
 * @param settings the options to use
 * @param progress callback progress
 * @param deep folder depth
 * @returns {object[]} array with file information
 * @private
 */
function statDirItem(collection, i, settings, progress, deep) {
  return __awaiter(this, void 0, void 0, function* () {
    const stats = yield stat(collection[i].fullname);
    collection[i].isDirectory = stats.isDirectory();
    if (settings.stats) {
      collection[i].stats = stats;
    }
    if (settings.readContent && !collection[i].isDirectory) {
      collection[i].data = yield readFile(collection[i].fullname, settings.encoding);
    }
    if (collection[i].isDirectory && settings.recursive) {
      const item = collection[i];
      if (settings.mode === exports.LIST) {
        const result = yield listDir(item.fullname, settings, progress, deep + 1);
        if (result.length) {
          collection = collection.concat(result);
        }
      }
      else {
        item.content = yield listDir(item.fullname, settings, progress, deep + 1);
        if (item.content && item.content.length === 0) {
          item.content = undefined;
        }
      }
    }
    return collection;
  });
}
/**
 * Returns a javascript object with directory items information (non blocking async with Promises)
 * @param path the path to start reading contents
 * @param [options] options (mode, recursive, stats, ignoreFolders)
 * @param [progress] callback with item data and progress info for each item
 * @returns promise array with file/folder information
 * @async
 */
function list(path, options, progress) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
  return __awaiter(this, void 0, void 0, function* () {
    // options skipped?
    if (typeof options === 'function') {
      progress = options;
    }
    // Setting default settings
    const settings = {
      mode: ((_a = options) === null || _a === void 0 ? void 0 : _a.mode) || exports.LIST,
      recursive: ((_b = options) === null || _b === void 0 ? void 0 : _b.recursive) === undefined ? true : options.recursive,
      stats: ((_c = options) === null || _c === void 0 ? void 0 : _c.stats) === undefined ? false : options.stats,
      ignoreFolders: ((_d = options) === null || _d === void 0 ? void 0 : _d.ignoreFolders) === undefined ? true : options.ignoreFolders,
      extensions: ((_e = options) === null || _e === void 0 ? void 0 : _e.extensions) === undefined ? false : options.extensions,
      deep: ((_f = options) === null || _f === void 0 ? void 0 : _f.deep) === undefined ? false : options.deep,
      realPath: ((_g = options) === null || _g === void 0 ? void 0 : _g.realPath) === undefined ? true : options.realPath,
      normalizePath: ((_h = options) === null || _h === void 0 ? void 0 : _h.normalizePath) === undefined ? true : options.normalizePath,
      include: ((_j = options) === null || _j === void 0 ? void 0 : _j.include) || [],
      exclude: ((_k = options) === null || _k === void 0 ? void 0 : _k.exclude) || [],
      readContent: ((_l = options) === null || _l === void 0 ? void 0 : _l.readContent) === undefined ? false : options.readContent,
      encoding: ((_m = options) === null || _m === void 0 ? void 0 : _m.encoding) || undefined,
    };
    // Setting pathSimbol if normalizePath is disabled
    if (settings.normalizePath === false) {
      pathSimbol = exports.PATH.sep;
    }
    else {
      pathSimbol = '/';
    }
    // Reading contents
    return listDir(path, settings, progress);
  });
}
exports.list = list;
