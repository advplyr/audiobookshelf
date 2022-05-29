"use strict";
/* CONSTS */
Object.defineProperty(exports, "__esModule", { value: true });
exports.S_IFSOCK = exports.S_IFREG = exports.S_IFMT = exports.S_IFLNK = exports.S_IFIFO = exports.S_IFDIR = exports.S_IFCHR = exports.S_IFBLK = exports.RETRY_TIMEOUT = exports.MAX_SAFE_INTEGER = exports.IS_WINDOWS = void 0;
const IS_WINDOWS = (process.platform === 'win32');
exports.IS_WINDOWS = IS_WINDOWS;
const { MAX_SAFE_INTEGER } = Number;
exports.MAX_SAFE_INTEGER = MAX_SAFE_INTEGER;
const RETRY_TIMEOUT = 5000;
exports.RETRY_TIMEOUT = RETRY_TIMEOUT;
const { S_IFBLK, S_IFCHR, S_IFDIR, S_IFIFO, S_IFLNK, S_IFMT, S_IFREG, S_IFSOCK } = process['binding']('constants').fs;
exports.S_IFBLK = S_IFBLK;
exports.S_IFCHR = S_IFCHR;
exports.S_IFDIR = S_IFDIR;
exports.S_IFIFO = S_IFIFO;
exports.S_IFLNK = S_IFLNK;
exports.S_IFMT = S_IFMT;
exports.S_IFREG = S_IFREG;
exports.S_IFSOCK = S_IFSOCK;
