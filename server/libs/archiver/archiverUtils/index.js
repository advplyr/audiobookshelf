/**
 * archiver-utils
 *
 * Copyright (c) 2015 Chris Talkington.
 * Licensed under the MIT license.
 * https://github.com/archiverjs/archiver-utils/blob/master/LICENSE
 */
var fs = require('graceful-fs');
var path = require('path');
// var lazystream = require('./lazystream');
var lazystream = require('./lazystream')
var normalizePath = require('../normalize-path');

var Stream = require('stream').Stream;
var PassThrough = require('./readableStream').PassThrough;

var utils = module.exports = {};
utils.file = require('./file.js');

utils.collectStream = function (source, callback) {
  var collection = [];
  var size = 0;

  source.on('error', callback);

  source.on('data', function (chunk) {
    collection.push(chunk);
    size += chunk.length;
  });

  source.on('end', function () {
    var buf = Buffer.alloc(size);
    var offset = 0;

    collection.forEach(function (data) {
      data.copy(buf, offset);
      offset += data.length;
    });

    callback(null, buf);
  });
};

utils.dateify = function (dateish) {
  dateish = dateish || new Date();

  if (dateish instanceof Date) {
    dateish = dateish;
  } else if (typeof dateish === 'string') {
    dateish = new Date(dateish);
  } else {
    dateish = new Date();
  }

  return dateish;
};

// this is slightly different from lodash version
utils.defaults = function (object, source) {
  object = Object(object)
  const sources = [source]
  const objectProto = Object.prototype
  const hasOwnProperty = objectProto.hasOwnProperty
  sources.forEach((source) => {
    if (source != null) {
      source = Object(source)
      for (const key in source) {
        const value = object[key]
        if (value === undefined ||
          (value == objectProto[key] && !hasOwnProperty.call(object, key))) {
          object[key] = source[key]
        }
      }
    }
  })
  return object
};

utils.isStream = function (source) {
  return source instanceof Stream;
};

utils.lazyReadStream = function (filepath) {
  return new lazystream.Readable(function () {
    return fs.createReadStream(filepath);
  });
};

utils.normalizeInputSource = function (source) {
  if (source === null) {
    return Buffer.alloc(0);
  } else if (typeof source === 'string') {
    return Buffer.from(source);
  } else if (utils.isStream(source)) {
    // Always pipe through a PassThrough stream to guarantee pausing the stream if it's already flowing,
    // since it will only be processed in a (distant) future iteration of the event loop, and will lose
    // data if already flowing now.
    return source.pipe(new PassThrough());
  }

  return source;
};

utils.sanitizePath = function (filepath) {
  return normalizePath(filepath, false).replace(/^\w+:/, '').replace(/^(\.\.\/|\/)+/, '');
};

utils.trailingSlashIt = function (str) {
  return str.slice(-1) !== '/' ? str + '/' : str;
};

utils.unixifyPath = function (filepath) {
  return normalizePath(filepath, false).replace(/^\w+:/, '');
};

utils.walkdir = function (dirpath, base, callback) {
  var results = [];

  if (typeof base === 'function') {
    callback = base;
    base = dirpath;
  }

  fs.readdir(dirpath, function (err, list) {
    var i = 0;
    var file;
    var filepath;

    if (err) {
      return callback(err);
    }

    (function next() {
      file = list[i++];

      if (!file) {
        return callback(null, results);
      }

      filepath = path.join(dirpath, file);

      fs.stat(filepath, function (err, stats) {
        results.push({
          path: filepath,
          relative: path.relative(base, filepath).replace(/\\/g, '/'),
          stats: stats
        });

        if (stats && stats.isDirectory()) {
          utils.walkdir(filepath, base, function (err, res) {
            res.forEach(function (dirEntry) {
              results.push(dirEntry);
            });
            next();
          });
        } else {
          next();
        }
      });
    })();
  });
};
