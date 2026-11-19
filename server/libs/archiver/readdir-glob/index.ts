//
// used by archiver
// Source: https://github.com/Yqnn/node-readdir-glob
//

import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import type { Dirent, Stats } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

interface GlobOptions {
  pattern?: string | string[];
  dot?: boolean;
  noglobstar?: boolean;
  matchBase?: boolean;
  nocase?: boolean;
  ignore?: string | string[];
  skip?: string | string[];
  follow?: boolean;
  stat?: boolean;
  nodir?: boolean;
  mark?: boolean;
  silent?: boolean;
  absolute?: boolean;
}

type GlobCallback = (error: unknown, matches?: string[]) => void;
type MatcherOptions = Pick<GlobOptions, 'dot' | 'noglobstar' | 'matchBase' | 'nocase'>;
type EntryStats = Stats | Dirent | Pick<Stats, 'isDirectory'>;
type ShouldSkip = (relative: string) => boolean;

interface Matcher {
  match(path: string): boolean;
}

interface WalkEntry {
  relative: string;
  absolute: string;
  stats: EntryStats;
}

interface GlobEvents {
  match: [entry: Omit<WalkEntry, 'stats'> & { stat?: EntryStats }];
  error: [error: unknown];
  end: [];
}

const { Minimatch } = createRequire(__filename)('../archiverUtils/minimatch') as {
  Minimatch: new (pattern: string, options: MatcherOptions) => Matcher;
};

function readdir(dir: string, strict: boolean) {
  return new Promise<(Dirent | string)[]>((resolve, reject) => {
    fs.readdir(dir, { withFileTypes: true }, (err, files) => {
      if (err) {
        switch (err.code) {
          case 'ENOTDIR':      // Not a directory
            if (strict) {
              reject(err);
            } else {
              resolve([]);
            }
            break;
          case 'ENOTSUP':      // Operation not supported
          case 'ENOENT':       // No such file or directory
          case 'ENAMETOOLONG': // Filename too long
          case 'UNKNOWN':
            resolve([]);
            break;
          case 'ELOOP':        // Too many levels of symbolic links
          default:
            reject(err);
            break;
        }
      } else {
        resolve(files);
      }
    });
  });
}
function stat(file: string, followSymlinks: boolean): Promise<Stats | null> {
  return new Promise((resolve) => {
    const statFunc = followSymlinks ? fs.stat : fs.lstat;
    statFunc(file, (err, stats) => {
      if (err) {
        switch (err.code) {
          case 'ENOENT':
            if (followSymlinks) {
              // Fallback to lstat to handle broken links as files
              resolve(stat(file, false));
            } else {
              resolve(null);
            }
            break;
          default:
            resolve(null);
            break;
        }
      } else {
        resolve(stats);
      }
    });
  });
}

async function* exploreWalkAsync(dir: string, path: string, followSymlinks: boolean, useStat: boolean, shouldSkip: ShouldSkip, strict: boolean): AsyncGenerator<WalkEntry> {
  let files = await readdir(path + dir, strict);
  for (const file of files) {
    const dirent = typeof file === 'string' ? undefined : file;
    let name = dirent?.name;
    if (name === undefined) {
      // undefined file.name means the `withFileTypes` options is not supported by node
      // we have to call the stat function to know if file is directory or not.
      name = file as string;
      useStat = true;
    }
    const filename = dir + '/' + name;
    const relative = filename.slice(1); // Remove the leading /
    const absolute = path + '/' + relative;
    let stats: EntryStats | null = null;
    if (useStat || followSymlinks) {
      stats = await stat(absolute, followSymlinks);
    }
    if (!stats && dirent?.name !== undefined) {
      stats = dirent;
    }
    if (stats === null) {
      stats = { isDirectory: () => false };
    }

    if (stats.isDirectory()) {
      if (!shouldSkip(relative)) {
        yield { relative, absolute, stats };
        yield* exploreWalkAsync(filename, path, followSymlinks, useStat, shouldSkip, false);
      }
    } else {
      yield { relative, absolute, stats };
    }
  }
}
async function* explore(path: string, followSymlinks: boolean, useStat: boolean, shouldSkip: ShouldSkip): AsyncGenerator<WalkEntry> {
  yield* exploreWalkAsync('', path, followSymlinks, useStat, shouldSkip, true);
}


function readOptions(options: GlobOptions) {
  return {
    pattern: options.pattern,
    dot: !!options.dot,
    noglobstar: !!options.noglobstar,
    matchBase: !!options.matchBase,
    nocase: !!options.nocase,
    ignore: options.ignore,
    skip: options.skip,

    follow: !!options.follow,
    stat: !!options.stat,
    nodir: !!options.nodir,
    mark: !!options.mark,
    silent: !!options.silent,
    absolute: !!options.absolute
  };
}

class ReaddirGlob extends EventEmitter<GlobEvents> {
  declare options: ReturnType<typeof readOptions>;
  declare matchers: Matcher[];
  declare ignoreMatchers: Matcher[];
  declare skipMatchers: Matcher[];
  declare iterator: AsyncGenerator<WalkEntry>;
  declare paused: boolean;
  declare inactive: boolean;
  declare aborted: boolean;
  declare _matches: string[];

  constructor(cwd?: string, options?: GlobOptions | GlobCallback | null, cb?: GlobCallback) {
    super();
    if (typeof options === 'function') {
      cb = options;
      options = null;
    }

    this.options = readOptions(options || {});

    this.matchers = [];
    if (this.options.pattern) {
      const matchers = Array.isArray(this.options.pattern) ? this.options.pattern : [this.options.pattern];
      this.matchers = matchers.map(m =>
        new Minimatch(m, {
          dot: this.options.dot,
          noglobstar: this.options.noglobstar,
          matchBase: this.options.matchBase,
          nocase: this.options.nocase
        })
      );
    }

    this.ignoreMatchers = [];
    if (this.options.ignore) {
      const ignorePatterns = Array.isArray(this.options.ignore) ? this.options.ignore : [this.options.ignore];
      this.ignoreMatchers = ignorePatterns.map(ignore =>
        new Minimatch(ignore, { dot: true })
      );
    }

    this.skipMatchers = [];
    if (this.options.skip) {
      const skipPatterns = Array.isArray(this.options.skip) ? this.options.skip : [this.options.skip];
      this.skipMatchers = skipPatterns.map(skip =>
        new Minimatch(skip, { dot: true })
      );
    }

    this.iterator = explore(resolve(cwd || '.'), this.options.follow, this.options.stat, this._shouldSkipDirectory.bind(this));
    this.paused = false;
    this.inactive = false;
    this.aborted = false;

    if (cb) {
      this._matches = [];
      this.on('match', match => this._matches.push(this.options.absolute ? match.absolute : match.relative));
      this.on('error', err => cb(err));
      this.on('end', () => cb(null, this._matches));
    }

    setTimeout(() => this._next(), 0);
  }

  _shouldSkipDirectory(relative: string) {
    //console.log(relative, this.skipMatchers.some(m => m.match(relative)));
    return this.skipMatchers.some(m => m.match(relative));
  }

  _fileMatches(relative: string, isDirectory: boolean) {
    const file = relative + (isDirectory ? '/' : '');
    return (this.matchers.length === 0 || this.matchers.some(m => m.match(file)))
      && !this.ignoreMatchers.some(m => m.match(file))
      && (!this.options.nodir || !isDirectory);
  }

  _next(iterator?: AsyncGenerator<WalkEntry>): void;
  _next() {
    if (!this.paused && !this.aborted) {
      this.iterator.next()
        .then((obj) => {
          if (!obj.done) {
            const isDirectory = obj.value.stats.isDirectory();
            if (this._fileMatches(obj.value.relative, isDirectory)) {
              let relative = obj.value.relative;
              let absolute = obj.value.absolute;
              if (this.options.mark && isDirectory) {
                relative += '/';
                absolute += '/';
              }
              if (this.options.stat) {
                this.emit('match', { relative, absolute, stat: obj.value.stats });
              } else {
                this.emit('match', { relative, absolute });
              }
            }
            this._next(this.iterator);
          } else {
            this.emit('end');
          }
        })
        .catch((err: unknown) => {
          this.abort();
          this.emit('error', err);
          if (!(err as { code?: unknown }).code && !this.options.silent) {
            console.error(err);
          }
        });
    } else {
      this.inactive = true;
    }
  }

  abort() {
    this.aborted = true;
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
    if (this.inactive) {
      this.inactive = false;
      this._next();
    }
  }
}


function readdirGlob(pattern?: string, options?: GlobOptions | GlobCallback | null, cb?: GlobCallback) {
  return new ReaddirGlob(pattern, options, cb);
}
readdirGlob.ReaddirGlob = ReaddirGlob;

export = readdirGlob;
