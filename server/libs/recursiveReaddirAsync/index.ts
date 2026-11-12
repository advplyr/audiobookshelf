/**
 * @packageDocumentation
 * project: recursive-readdir-async
 * @author: m0rtadelo (ricard.figuls)
 * @license MIT
 * 2018
 */

// SOURCE: https://github.com/m0rtadelo/recursive-readdir-async

import * as nativeFs from 'node:fs';
import type { PathLike, Stats } from 'node:fs';
import * as nativePath from 'node:path';

/** List items in a flat array. */
export const LIST = 1;
/** Nest items under directory entries. */
export const TREE = 2;
export const FS = nativeFs;
export const PATH = nativePath;

export interface ListOptions {
  mode?: typeof LIST | typeof TREE;
  recursive?: boolean;
  stats?: boolean;
  ignoreFolders?: boolean;
  extensions?: boolean;
  deep?: boolean;
  realPath?: boolean;
  normalizePath?: boolean;
  include?: string[];
  exclude?: string[];
  readContent?: boolean;
  encoding?: BufferEncoding;
}

type Settings = Required<Omit<ListOptions, 'encoding'>> & Pick<ListOptions, 'encoding'>;

export interface FileEntry {
  name: string;
  title: string;
  path: string;
  fullname: string;
  extension?: string;
  deep?: number;
  isDirectory?: boolean;
  stats?: Stats;
  data?: string;
  content?: Listing;
  error?: unknown;
}

export interface ListError {
  error: unknown;
  path: string;
}

type Listing = FileEntry[] | ListError;
type DetailedEntry = FileEntry & { extension: string; deep: number };
type Progress = ((entry: FileEntry, completed: number, total: number) => unknown) & ListOptions;

let pathSimbol = '/';
/**
 * Returns a Promise with Stats info of the item (file/folder/...)
 * @param file the name of the object to get stats from
 * @returns {Promise<fs.Stats>} stat object information
 * @async
 */
export async function stat(file: PathLike): Promise<Stats> {
  return new Promise(function (resolve, reject) {
    FS.stat(file, function (err, stats) {
      if (err) {
        reject(err);
      }
      else {
        resolve(stats);
      }
    });
  });
}
/**
 * Returns a Promise with content (data) of the file
 * @param file the name of the file to read content from
 * @param encoding format for returned data (ascii, base64, binary, hex, ucs2/ucs-2/utf16le/utf-16le,
 *  utf8/utf-8, latin1). Default: base64
 * @returns {Promise<string>} data content string (base64 format by default)
 * @async
 */
export async function readFile(file: PathLike | number, encoding: BufferEncoding = 'base64'): Promise<string> {
  return new Promise(function (resolve, reject) {
    FS.readFile(file, { encoding }, function (err, data) {
      if (err) {
        reject(err);
      }
      else {
        resolve(data);
      }
    });
  });
}
/**
 * Returns if an item should be added based on include/exclude options.
 * @param path the item fullpath
 * @param settings the options configuration to use
 * @returns {boolean} if item must be added
 * @private
 */
function checkItem(path: string, settings: Settings) {
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
function addOptionalKeys(obj: FileEntry, file: string, settings: Settings, deep: number) {
  if (settings.extensions) {
    obj.extension = (PATH.extname(file)).toLowerCase();
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
function read(rpath: string, data: FileEntry[], settings: Settings, deep: number, resolve: (data: FileEntry[]) => void, reject: (error: NodeJS.ErrnoException) => void) {
  FS.readdir(rpath, function (error, files) {
    // If error reject them
    if (error) {
      reject(error);
    }
    else {
      const removeExt = (file: string) => {
        const extSize = PATH.extname(file).length;
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
 * Returns a Promise with directory entries.
 * @param path the item fullpath to be searched for
 * @param settings the options configuration to use
 * @param deep folder depth value
 * @returns the file entries
 * @private
 */
async function myReaddir(path: string, settings: Settings, deep: number): Promise<FileEntry[]> {
  const data: FileEntry[] = [];
  return new Promise(function (resolve, reject) {
    // Asynchronously computes the canonical pathname by resolving ., .. and symbolic links.
    FS.realpath(path, function (err, rpath) {
      if (err || settings.realPath === false) {
        rpath = path;
      }
      if (settings.normalizePath) {
        rpath = normalizePath(rpath);
      }
      read(rpath, data, settings, deep, resolve, reject);
    });
  });
}
/**
 * Normalizes windows style paths by replacing double backslahes with single forward slahes (unix style).
 * @param path windows/unix path
 * @return {string} normalized path (unix style)
 * @private
 */
function normalizePath(path: string) {
  return path.toString().replace(/\\/g, '/');
}
/**
     * Search if the fullname exist in the include array
     * @param fullname - The fullname of the item to search for
     * @param settings the options to be used
     * @returns true if exists
     */
function exists(fullname: string, settings: Settings) {
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
function onlyInclude(settings: Settings, content: FileEntry[]) {
  if (settings.include && settings.include.length > 0) {
    for (let i = content.length - 1; i > -1; i--) {
      const item = content[i];
      if (settings.mode === TREE && item.isDirectory && item.content)
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
async function listDir(path: string, settings: Settings, progress: Progress | undefined, deep = 0): Promise<Listing> {
  let content: FileEntry[];
  try {
    content = await myReaddir(path, settings, deep);
  }
  catch (err) {
    return { 'error': err, 'path': path };
  }
  if (settings.stats || settings.recursive || !settings.ignoreFolders ||
    settings.readContent || settings.mode === TREE) {
    content = await statDir(content, settings, progress, deep);
  }
  onlyInclude(settings, content);
  return content;
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
async function statDir(collection: FileEntry[], settings: Settings, progress: Progress | undefined, deep: number) {
  let isOk = true;
  for (let i = collection.length - 1; i > -1; i--) {
    try {
      collection = await statDirItem(collection, i, settings, progress, deep);
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
async function statDirItem(collection: FileEntry[], i: number, settings: Settings, progress: Progress | undefined, deep: number) {
  const stats = await stat(collection[i].fullname);
  collection[i].isDirectory = stats.isDirectory();
  if (settings.stats) {
    collection[i].stats = stats;
  }
  if (settings.readContent && !collection[i].isDirectory) {
    collection[i].data = await readFile(collection[i].fullname, settings.encoding);
  }
  if (collection[i].isDirectory && settings.recursive) {
    const item = collection[i];
    if (settings.mode === LIST) {
      const result = await listDir(item.fullname, settings, progress, deep + 1);
      if (Array.isArray(result) && result.length) {
        collection = collection.concat(result);
      }
    }
    else {
      item.content = await listDir(item.fullname, settings, progress, deep + 1);
      if (Array.isArray(item.content) && item.content.length === 0) {
        item.content = undefined;
      }
    }
  }
  return collection;
}
/**
 * Returns a javascript object with directory items information (non blocking async with Promises)
 * @param path the path to start reading contents
 * @param [options] options (mode, recursive, stats, ignoreFolders)
 * @param [progress] callback with item data and progress info for each item
 * @returns promise array with file/folder information
 * @async
 */
export function list(path: string, options: ListOptions & { extensions: true; deep: true }, progress?: Progress): Promise<DetailedEntry[] | ListError>;
export function list(path: string, options?: ListOptions | Progress, progress?: Progress): Promise<Listing>;
export async function list(path: string, options?: ListOptions | Progress, progress?: Progress): Promise<Listing> {
  // options skipped?
  if (typeof options === 'function') {
    progress = options;
  }
  // A callback passed as options can still carry properties.
  const config = options;
  // Setting default settings
  const settings: Settings = {
    mode: config?.mode || LIST,
    recursive: config?.recursive === undefined ? true : config.recursive,
    stats: config?.stats === undefined ? false : config.stats,
    ignoreFolders: config?.ignoreFolders === undefined ? true : config.ignoreFolders,
    extensions: config?.extensions === undefined ? false : config.extensions,
    deep: config?.deep === undefined ? false : config.deep,
    realPath: config?.realPath === undefined ? true : config.realPath,
    normalizePath: config?.normalizePath === undefined ? true : config.normalizePath,
    include: config?.include || [],
    exclude: config?.exclude || [],
    readContent: config?.readContent === undefined ? false : config.readContent,
    encoding: config?.encoding || undefined,
  };
  // Setting pathSimbol if normalizePath is disabled
  if (settings.normalizePath === false) {
    pathSimbol = PATH.sep;
  }
  else {
    pathSimbol = '/';
  }
  // Reading contents
  return listDir(path, settings, progress);
}
