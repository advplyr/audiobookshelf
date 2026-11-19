/* istanbul ignore file - tested in node */
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

import fs from 'node:fs';
import type { Stats } from 'node:fs';
import pathModule from 'node:path';

var isWindows = process.platform === 'win32';

type RealpathCache = Record<string, string>;
type RealpathCallback = (error: NodeJS.ErrnoException | null, result?: string) => void;

// JavaScript implementation of realpath, ported from node pre-v6

var DEBUG = process.env.NODE_DEBUG && /fs/.test(process.env.NODE_DEBUG);

function rethrow(): RealpathCallback {
  // Only enable in debug mode. A backtrace uses ~1000 bytes of heap space and
  // is fairly slow to generate.
  var callback;
  if (DEBUG) {
    var backtrace = new Error;
    callback = debugCallback;
  } else
    callback = missingCallback;

  return callback;

  function debugCallback(err: Error | null) {
    if (err) {
      backtrace.message = err.message;
      err = backtrace;
      missingCallback(err);
    }
  }

  function missingCallback(err: Error | null) {
    if (err) {
      if (process.throwDeprecation)
        throw err;  // Forgot a callback but don't know where? Use NODE_DEBUG=fs
      else if (!process.noDeprecation) {
        var msg = 'fs: missing callback ' + (err.stack || err.message);
        if (process.traceDeprecation)
          console.trace(msg);
        else
          console.error(msg);
      }
    }
  }
}

function maybeCallback(cb: RealpathCache | RealpathCallback | null) {
  return typeof cb === 'function' ? cb : rethrow();
}

// Regexp that finds the next partion of a (partial) path
// result is [base_with_slash, base], e.g. ['somedir/', 'somedir']
if (isWindows) {
  var nextPartRe = /(.*?)(?:[\/\\]+|$)/g;
} else {
  var nextPartRe = /(.*?)(?:[\/]+|$)/g;
}

// Regex to find the device root, including trailing slash. E.g. 'c:\\'.
if (isWindows) {
  var splitRootRe = /^(?:[a-zA-Z]:|[\\\/]{2}[^\\\/]+[\\\/][^\\\/]+)?[\\\/]*/;
} else {
  var splitRootRe = /^[\/]*/;
}

function realpathSync(p: string, cache?: RealpathCache | null) {
  // make p is absolute
  p = pathModule.resolve(p);

  if (cache && Object.prototype.hasOwnProperty.call(cache, p)) {
    return cache[p];
  }

  var original = p,
    seenLinks: Record<string, string> = {},
    knownHard: Record<string, boolean> = {};

  // current character position in p
  var pos!: number;
  // the partial path so far, including a trailing slash if any
  var current!: string;
  // the partial path without a trailing slash (except when pointing at a root)
  var base: string;
  // the partial path scanned in the previous round, with slash
  var previous: string;

  start();

  function start() {
    // Skip over roots
    var m = splitRootRe.exec(p)!;
    pos = m[0].length;
    current = m[0];
    base = m[0];
    previous = '';

    // On windows, check that the root exists. On unix there is no need.
    if (isWindows && !knownHard[base]) {
      fs.lstatSync(base);
      knownHard[base] = true;
    }
  }

  // walk down the path, swapping out linked pathparts for their real
  // values
  // NB: p.length changes.
  while (pos < p.length) {
    // find the next part
    nextPartRe.lastIndex = pos;
    var result = nextPartRe.exec(p)!;
    previous = current;
    current += result[0];
    base = previous + result[1];
    pos = nextPartRe.lastIndex;

    // continue if not a symlink
    if (knownHard[base] || (cache && cache[base] === base)) {
      continue;
    }

    var resolvedLink;
    if (cache && Object.prototype.hasOwnProperty.call(cache, base)) {
      // some known symbolic link.  no need to stat again.
      resolvedLink = cache[base];
    } else {
      var stat = fs.lstatSync(base);
      if (!stat.isSymbolicLink()) {
        knownHard[base] = true;
        if (cache) cache[base] = base;
        continue;
      }

      // read the link if it wasn't read before
      // dev/ino always return 0 on windows, so skip the check.
      var linkTarget: string | null = null;
      var id: string | undefined;
      if (!isWindows) {
        id = stat.dev.toString(32) + ':' + stat.ino.toString(32);
        if (seenLinks.hasOwnProperty(id)) {
          linkTarget = seenLinks[id];
        }
      }
      if (linkTarget === null) {
        fs.statSync(base);
        linkTarget = fs.readlinkSync(base);
      }
      resolvedLink = pathModule.resolve(previous, linkTarget);
      // track this, if given a cache.
      if (cache) cache[base] = resolvedLink;
      if (!isWindows) seenLinks[id!] = linkTarget;
    }

    // resolve the link, then start over
    p = pathModule.resolve(resolvedLink, p.slice(pos));
    start();
  }

  if (cache) cache[original] = p;

  return p;
}


function realpath(p: string, cache: RealpathCache | RealpathCallback | null, cb?: RealpathCallback) {
  if (typeof cb !== 'function') {
    cb = maybeCallback(cache);
    cache = null;
  }
  const callback = cb;
  const pathCache = cache as RealpathCache | null;

  // make p is absolute
  p = pathModule.resolve(p);

  if (pathCache && Object.prototype.hasOwnProperty.call(pathCache, p)) {
    return process.nextTick(callback.bind(null, null, pathCache[p]));
  }

  var original = p,
    seenLinks: Record<string, string> = {},
    knownHard: Record<string, boolean> = {};

  // current character position in p
  var pos: number;
  // the partial path so far, including a trailing slash if any
  var current: string;
  // the partial path without a trailing slash (except when pointing at a root)
  var base: string;
  // the partial path scanned in the previous round, with slash
  var previous: string;

  start();

  function start() {
    // Skip over roots
    var m = splitRootRe.exec(p)!;
    pos = m[0].length;
    current = m[0];
    base = m[0];
    previous = '';

    // On windows, check that the root exists. On unix there is no need.
    if (isWindows && !knownHard[base]) {
      fs.lstat(base, function (err) {
        if (err) return callback(err);
        knownHard[base] = true;
        LOOP();
      });
    } else {
      process.nextTick(LOOP);
    }
  }

  // walk down the path, swapping out linked pathparts for their real
  // values
  function LOOP() {
    // stop if scanned past end of path
    if (pos >= p.length) {
      if (pathCache) pathCache[original] = p;
      return callback(null, p);
    }

    // find the next part
    nextPartRe.lastIndex = pos;
    var result = nextPartRe.exec(p)!;
    previous = current;
    current += result[0];
    base = previous + result[1];
    pos = nextPartRe.lastIndex;

    // continue if not a symlink
    if (knownHard[base] || (pathCache && pathCache[base] === base)) {
      return process.nextTick(LOOP);
    }

    if (pathCache && Object.prototype.hasOwnProperty.call(pathCache, base)) {
      // known symbolic link.  no need to stat again.
      return gotResolvedLink(pathCache[base]);
    }

    return fs.lstat(base, gotStat);
  }

  function gotStat(err: NodeJS.ErrnoException | null, stat: Stats) {
    if (err) return callback(err);

    // if not a symlink, skip to the next path part
    if (!stat.isSymbolicLink()) {
      knownHard[base] = true;
      if (pathCache) pathCache[base] = base;
      return process.nextTick(LOOP);
    }

    // stat & read the link if not read before
    // call gotTarget as soon as the link target is known
    // dev/ino always return 0 on windows, so skip the check.
    var id: string | undefined;
    if (!isWindows) {
      id = stat.dev.toString(32) + ':' + stat.ino.toString(32);
      if (seenLinks.hasOwnProperty(id)) {
        return gotTarget(null, seenLinks[id], base);
      }
    }
    fs.stat(base, function (err) {
      if (err) return callback(err);

      fs.readlink(base, function (err, target) {
        if (!isWindows) seenLinks[id!] = target;
        gotTarget(err, target);
      });
    });
  }

  function gotTarget(err: NodeJS.ErrnoException | null, target: string, base?: string) {
    if (err) return callback(err);

    var resolvedLink = pathModule.resolve(previous, target);
    if (pathCache) pathCache[String(base)] = resolvedLink;
    gotResolvedLink(resolvedLink);
  }

  function gotResolvedLink(resolvedLink: string) {
    // resolve the link, then start over
    p = pathModule.resolve(resolvedLink, p.slice(pos));
    start();
  }
}

export = { realpathSync, realpath };
