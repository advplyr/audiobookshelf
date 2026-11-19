/**
 * archiver-utils
 *
 * Copyright (c) 2012-2014 Chris Talkington, contributors.
 * Licensed under the MIT license.
 * https://github.com/archiverjs/node-archiver/blob/master/LICENSE-MIT
 */
import fs from 'graceful-fs';
import type { Stats } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

type StatPredicate = {
  [Key in keyof Stats]: Stats[Key] extends () => boolean ? Key : never;
}[keyof Stats];

interface ExpandOptions {
  cwd?: string;
  filter?: StatPredicate | ((filepath: string) => boolean);
}

interface MappingOptions extends ExpandOptions {
  flatten?: boolean;
  ext?: string;
  rename?: (base: string | undefined, dest: string, options: MappingOptions) => string;
}

type Patterns = (string | string[])[];

interface FileMappingInput extends MappingOptions {
  src?: string | Patterns;
  dest?: string;
  expand?: boolean;
  orig?: FileMappingInput;
}

interface FileMapping {
  src: string[];
  dest: string;
}

interface LodashChain<Value> {
  chain(): LodashChain<Value>;
  forEach(iteratee: (value: Value) => void): LodashChain<Value>;
  map<Mapped>(iteratee: (value: Value) => Mapped | Mapped[]): { flatten(): { value(): Mapped[] } };
}

// Multi-task normalization expects Lodash to be supplied as a global.
declare const _: <Value>(values: Value[]) => LodashChain<Value>;

const load = createRequire(__filename);
const flatten = load('./lodash.flatten') as (patterns: Patterns) => string[];
const difference = load('./lodash.difference') as (left: string[], right: string[]) => string[];
const union = load('./lodash.union') as (left: string[], right: string[]) => string[];
const isPlainObject = load('./lodash.isplainobject') as (value: unknown) => value is ExpandOptions;
const glob = load('./glob') as { sync(pattern: string, options: ExpandOptions): string[] };

var pathSeparatorRe = /[\/\\]/g;

// Process specified wildcard glob patterns or filenames against a
// callback, excluding and uniquing files in the result set.
function processPatterns(patterns: Patterns, fn: (pattern: string) => string[]) {
  // Filepaths to return.
  var result: string[] = [];
  // Iterate over flattened patterns array.
  flatten(patterns).forEach(function (pattern) {
    // If the first character is ! it should be omitted
    var exclusion = pattern.indexOf('!') === 0;
    // If the pattern is an exclusion, remove the !
    if (exclusion) { pattern = pattern.slice(1); }
    // Find all matching files for this pattern.
    var matches = fn(pattern);
    if (exclusion) {
      // If an exclusion, remove matching files.
      result = difference(result, matches);
    } else {
      // Otherwise add matching files.
      result = union(result, matches);
    }
  });
  return result;
}

// True if the file path exists.
function exists(...parts: string[]) {
  var filepath = path.join(...parts);
  return fs.existsSync(filepath);
}

// Return an array of all file paths that match the given wildcard patterns.
function expand(...args: (ExpandOptions | string | Patterns | undefined)[]) {
  // If the first argument is an options object, save those options to pass
  // into the File.prototype.glob.sync method.
  var options = isPlainObject(args[0]) ? args.shift() as ExpandOptions : {};
  // Use the first argument if it's an Array, otherwise convert the arguments
  // object to an array and use that.
  var patterns = Array.isArray(args[0]) ? args[0] : args as Patterns;
  // Return empty set if there are no patterns or filepaths.
  if (patterns.length === 0) { return []; }
  // Return all matching filepaths.
  var matches = processPatterns(patterns, function (pattern) {
    // Find all matching files for this pattern.
    return glob.sync(pattern, options);
  });
  // Filter result set?
  if (options.filter) {
    matches = matches.filter(function (filepath) {
      filepath = path.join(options.cwd || '', filepath);
      try {
        if (typeof options.filter === 'function') {
          return options.filter(filepath);
        } else {
          // If the file is of the right type and exists, this should work.
          return fs.statSync(filepath)[options.filter!]();
        }
      } catch {
        // Otherwise, it's probably not the right type.
        return false;
      }
    });
  }
  return matches;
}

// Build a multi task "files" object dynamically.
function expandMapping(patterns?: string | Patterns, destBase?: string, mappingOptions?: MappingOptions) {
  const options = Object.assign({
    rename: function (destBase: string | undefined, destPath: string) {
      return path.join(destBase || '', destPath);
    }
  }, mappingOptions);
  var files: FileMapping[] = [];
  var fileByDest: Record<string, FileMapping> = {};
  // Find all files matching pattern, using passed-in options.
  file.expand(options, patterns).forEach(function (src) {
    var destPath = src;
    // Flatten?
    if (options.flatten) {
      destPath = path.basename(destPath);
    }
    // Change the extension?
    if (options.ext) {
      destPath = destPath.replace(/(\.[^\/]*)?$/, options.ext);
    }
    // Generate destination filename.
    var dest = options.rename(destBase, destPath, options);
    // Prepend cwd to src path if necessary.
    if (options.cwd) { src = path.join(options.cwd, src); }
    // Normalize filepaths to be unix-style.
    dest = dest.replace(pathSeparatorRe, '/');
    src = src.replace(pathSeparatorRe, '/');
    // Map correct src path to dest path.
    if (fileByDest[dest]) {
      // If dest already exists, push this src onto that dest's src array.
      fileByDest[dest].src.push(src);
    } else {
      // Otherwise create a new src-dest file mapping object.
      files.push({
        src: [src],
        dest: dest,
      });
      // And store a reference for later use.
      fileByDest[dest] = files[files.length - 1];
    }
  });
  return files;
}

// reusing bits of grunt's multi-task source normalization
function normalizeFilesArray(data: FileMappingInput[]) {
  var files: FileMappingInput[] = [];

  data.forEach(function (obj) {
    if ('src' in obj || 'dest' in obj) {
      files.push(obj);
    }
  });

  if (files.length === 0) {
    return [];
  }

  files = _(files).chain().forEach(function (obj) {
    if (!('src' in obj) || !obj.src) { return; }
    // Normalize .src properties to flattened array.
    if (Array.isArray(obj.src)) {
      obj.src = flatten(obj.src);
    } else {
      obj.src = [obj.src];
    }
  }).map<FileMappingInput>(function (obj) {
    // Build options object, removing unwanted properties.
    var expandOptions = Object.assign({}, obj);
    delete expandOptions.src;
    delete expandOptions.dest;

    // Expand file mappings.
    if (obj.expand) {
      return file.expandMapping(obj.src, obj.dest, expandOptions).map(function (mapObj) {
        // Copy obj properties to result.
        var result = Object.assign({}, obj);
        // Make a clone of the orig obj available.
        result.orig = Object.assign({}, obj);
        // Set .src and .dest, processing both as templates.
        result.src = mapObj.src;
        result.dest = mapObj.dest;
        // Remove unwanted properties.
        const removedProperties = ['expand', 'cwd', 'flatten', 'rename', 'ext'] as const;
        removedProperties.forEach(function (prop) {
          delete result[prop];
        });
        return result;
      });
    }

    // Copy obj properties to result, adding an .orig property.
    var result = Object.assign({}, obj);
    // Make a clone of the orig obj available.
    result.orig = Object.assign({}, obj);

    if ('src' in result) {
      const getSource: (() => string[] | undefined) & { result?: string[] } = function fn() {
        if (!('result' in getSource)) {
          // If src is an array, flatten it. Otherwise, make it into an array.
          var src = Array.isArray(obj.src) ? flatten(obj.src) : [obj.src] as Patterns;
          // Expand src files, memoizing result.
          getSource.result = file.expand(expandOptions, src);
        }
        return getSource.result;
      };
      // Expose an expand-on-demand getter method as .src.
      Object.defineProperty(result, 'src', {
        enumerable: true,
        get: getSource
      });
    }

    if ('dest' in result) {
      result.dest = obj.dest;
    }

    return result;
  }).flatten().value();

  return files;
}

const file = { exists, expand, expandMapping, normalizeFilesArray };
export = file;
