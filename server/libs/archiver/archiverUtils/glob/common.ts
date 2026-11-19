import fs from 'node:fs'
import type { Stats } from 'node:fs'
import { createRequire } from 'node:module'
import path, { isAbsolute } from 'node:path'

type FileCache = Record<string, string[] | 'DIR' | 'FILE' | boolean | undefined>
type StatCache = Record<string, Stats | false | undefined>
type SymlinkCache = Record<string, boolean | undefined>
type RealpathCache = Record<string, string>
type Matches = Record<string, boolean>

interface GlobOptions {
  absolute?: boolean
  allowWindowsEscape?: boolean
  cache?: FileCache
  cwd?: string
  dot?: boolean
  follow?: boolean
  fs?: typeof fs
  ignore?: string | string[]
  mark?: boolean
  matchBase?: boolean
  maxLength?: number
  nocase?: boolean
  nocomment?: boolean
  nodir?: boolean
  noglobstar?: boolean
  nomount?: boolean
  nonegate?: boolean
  nonull?: boolean
  noprocess?: boolean
  nosort?: boolean
  nounique?: boolean
  realpath?: boolean
  realpathCache?: RealpathCache
  root?: string
  silent?: boolean
  stat?: boolean
  statCache?: StatCache
  strict?: boolean
  symlinks?: SymlinkCache
  sync?: boolean
}

interface GlobPattern {
  match(path: string): boolean
  globSet: string[]
  set: (string | RegExp | symbol)[][]
  options: GlobOptions
}

interface Ignore {
  matcher: GlobPattern
  gmatcher: GlobPattern | null
}

interface GlobState {
  silent: boolean
  pattern: string
  strict: boolean
  realpath: boolean
  realpathCache: RealpathCache
  follow: boolean
  dot: boolean
  mark: boolean
  nodir: boolean
  sync: boolean
  nounique: boolean
  nonull: boolean
  nosort: boolean
  nocase: boolean
  stat: boolean
  noprocess: boolean
  absolute: boolean
  fs: typeof fs
  maxLength: number
  cache: FileCache
  statCache: StatCache
  symlinks: SymlinkCache
  ignore: Ignore[]
  changedCwd: boolean
  cwd: string
  cwdAbs: string
  root: string
  nomount: boolean
  minimatch: GlobPattern
  options: GlobOptions
  matches: (Matches | undefined)[]
  found: string[]
  _mark(path: string): string
}

declare const exports: {
  setopts: typeof setopts
  ownProp: typeof ownProp
  makeAbs: typeof makeAbs
  finish: typeof finish
  mark: typeof mark
  isIgnored: typeof isIgnored
  childrenIgnored: typeof childrenIgnored
}

exports.setopts = setopts
exports.ownProp = ownProp
exports.makeAbs = makeAbs
exports.finish = finish
exports.mark = mark
exports.isIgnored = isIgnored
exports.childrenIgnored = childrenIgnored

function ownProp(obj: object, field: PropertyKey) {
  return Object.prototype.hasOwnProperty.call(obj, field)
}

const { Minimatch } = createRequire(__filename)('../minimatch') as {
  Minimatch: new (pattern: string, options: GlobOptions) => GlobPattern
}

function alphasort(a: string, b: string) {
  return a.localeCompare(b, 'en')
}

function setupIgnores(self: GlobState, options: GlobOptions) {
  const setup = self as { ignore: string | string[] | Ignore[] }
  setup.ignore = options.ignore || []

  if (!Array.isArray(setup.ignore))
    setup.ignore = [setup.ignore]

  if (setup.ignore.length) {
    setup.ignore = setup.ignore.map(ignoreMap)
  }
}

// ignore patterns are always in dot:true mode.
function ignoreMap(pattern: string): Ignore {
  var gmatcher: GlobPattern | null = null
  if (pattern.slice(-3) === '/**') {
    var gpattern = pattern.replace(/(\/\*\*)+$/, '')
    gmatcher = new Minimatch(gpattern, { dot: true })
  }

  return {
    matcher: new Minimatch(pattern, { dot: true }),
    gmatcher: gmatcher
  }
}

function setopts(self: GlobState, pattern: string, options?: GlobOptions | null) {
  if (!options)
    options = {}

  // base-matching: just use globstar for that.
  if (options.matchBase && -1 === pattern.indexOf("/")) {
    if (options.noglobstar) {
      throw new Error("base matching requires globstar")
    }
    pattern = "**/" + pattern
  }

  self.silent = !!options.silent
  self.pattern = pattern
  self.strict = options.strict !== false
  self.realpath = !!options.realpath
  self.realpathCache = options.realpathCache || Object.create(null) as RealpathCache
  self.follow = !!options.follow
  self.dot = !!options.dot
  self.mark = !!options.mark
  self.nodir = !!options.nodir
  if (self.nodir)
    self.mark = true
  self.sync = !!options.sync
  self.nounique = !!options.nounique
  self.nonull = !!options.nonull
  self.nosort = !!options.nosort
  self.nocase = !!options.nocase
  self.stat = !!options.stat
  self.noprocess = !!options.noprocess
  self.absolute = !!options.absolute
  self.fs = options.fs || fs

  self.maxLength = options.maxLength || Infinity
  self.cache = options.cache || Object.create(null) as FileCache
  self.statCache = options.statCache || Object.create(null) as StatCache
  self.symlinks = options.symlinks || Object.create(null) as SymlinkCache

  setupIgnores(self, options)

  self.changedCwd = false
  var cwd = process.cwd()
  if (!ownProp(options, "cwd"))
    self.cwd = path.resolve(cwd)
  else {
    self.cwd = path.resolve(options.cwd!)
    self.changedCwd = self.cwd !== cwd
  }

  self.root = options.root || path.resolve(self.cwd, "/")
  self.root = path.resolve(self.root)

  // TODO: is an absolute `cwd` supposed to be resolved against `root`?
  // e.g. { cwd: '/test', root: __dirname } === path.join(__dirname, '/test')
  self.cwdAbs = isAbsolute(self.cwd) ? self.cwd : makeAbs(self, self.cwd)
  self.nomount = !!options.nomount

  if (process.platform === "win32") {
    self.root = self.root.replace(/\\/g, "/")
    self.cwd = self.cwd.replace(/\\/g, "/")
    self.cwdAbs = self.cwdAbs.replace(/\\/g, "/")
  }

  // disable comments and negation in Minimatch.
  // Note that they are not supported in Glob itself anyway.
  options.nonegate = true
  options.nocomment = true
  // always treat \ in patterns as escapes, not path separators
  options.allowWindowsEscape = true

  self.minimatch = new Minimatch(pattern, options)
  self.options = self.minimatch.options
}

function finish(self: GlobState) {
  var nou = self.nounique
  var all: string[] | Matches = nou ? [] : Object.create(null) as Matches

  for (var i = 0, l = self.matches.length; i < l; i++) {
    var matches = self.matches[i]
    if (!matches || Object.keys(matches).length === 0) {
      if (self.nonull) {
        // do like the shell, and spit out the literal glob
        var literal = self.minimatch.globSet[i]
        if (Array.isArray(all))
          all.push(literal)
        else
          all[literal] = true
      }
    } else {
      // had matches
      var m = Object.keys(matches)
      if (Array.isArray(all)) {
        all.push.apply(all, m)
      } else {
        const uniqueMatches = all
        m.forEach(function (m) {
          uniqueMatches[m] = true
        })
      }
    }
  }

  var found = Array.isArray(all) ? all : Object.keys(all)

  if (!self.nosort)
    found = found.sort(alphasort)

  // at *some* point we statted all of these
  if (self.mark) {
    for (var i = 0; i < found.length; i++) {
      found[i] = self._mark(found[i])
    }
    if (self.nodir) {
      found = found.filter(function (e) {
        var notDir = !(/\/$/.test(e))
        var c = self.cache[e] || self.cache[makeAbs(self, e)]
        if (notDir && c)
          notDir = c !== 'DIR' && !Array.isArray(c)
        return notDir
      })
    }
  }

  if (self.ignore.length)
    found = found.filter(function (m) {
      return !isIgnored(self, m)
    })

  self.found = found
}

function mark(self: GlobState, p: string) {
  var abs = makeAbs(self, p)
  var c = self.cache[abs]
  var m = p
  if (c) {
    var isDir = c === 'DIR' || Array.isArray(c)
    var slash = p.slice(-1) === '/'

    if (isDir && !slash)
      m += '/'
    else if (!isDir && slash)
      m = m.slice(0, -1)

    if (m !== p) {
      var mabs = makeAbs(self, m)
      self.statCache[mabs] = self.statCache[abs]
      self.cache[mabs] = self.cache[abs]
    }
  }

  return m
}

// lotta situps...
function makeAbs(self: GlobState, f: string) {
  var abs = f
  if (f.charAt(0) === '/') {
    abs = path.join(self.root, f)
  } else if (isAbsolute(f) || f === '') {
    abs = f
  } else if (self.changedCwd) {
    abs = path.resolve(self.cwd, f)
  } else {
    abs = path.resolve(f)
  }

  if (process.platform === 'win32')
    abs = abs.replace(/\\/g, '/')

  return abs
}


// Return true, if pattern ends with globstar '**', for the accompanying parent directory.
// Ex:- If node_modules/** is the pattern, add 'node_modules' to ignore list along with it's contents
function isIgnored(self: GlobState, path: string) {
  if (!self.ignore.length)
    return false

  return self.ignore.some(function (item) {
    return item.matcher.match(path) || !!(item.gmatcher && item.gmatcher.match(path))
  })
}

function childrenIgnored(self: GlobState, path: string) {
  if (!self.ignore.length)
    return false

  return self.ignore.some(function (item) {
    return !!(item.gmatcher && item.gmatcher.match(path))
  })
}

export = exports
