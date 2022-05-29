"use strict";
/* IMPORT */
Object.defineProperty(exports, "__esModule", { value: true });
const consts_1 = require("./consts");
/* HELPERS */
const { floor } = Math;
const toNumber = Number;
/* STATS */
class Stats {
    /* CONSTRUCTOR */
    constructor(stats) {
        this.dev = toNumber(stats[0]);
        this.mode = toNumber(stats[1]);
        this.nlink = toNumber(stats[2]);
        this.uid = toNumber(stats[3]);
        this.gid = toNumber(stats[4]);
        this.rdev = toNumber(stats[5]);
        this.blksize = toNumber(stats[6]);
        this.ino = (stats[7] <= consts_1.MAX_SAFE_INTEGER) ? toNumber(stats[7]) : stats[7];
        this.size = toNumber(stats[8]);
        this.blocks = toNumber(stats[9]);
        this.atimeMs = (toNumber(stats[10]) * 1000) + floor(toNumber(stats[11]) / 1000000);
        this.mtimeMs = (toNumber(stats[12]) * 1000) + floor(toNumber(stats[13]) / 1000000);
        this.ctimeMs = (toNumber(stats[14]) * 1000) + floor(toNumber(stats[15]) / 1000000);
        this.birthtimeMs = (toNumber(stats[16]) * 1000) + floor(toNumber(stats[17]) / 1000000);
    }
    /* HELPERS */
    _isMode(mode) {
        return (this.mode & consts_1.S_IFMT) === mode;
    }
    /* API */
    isDirectory() {
        return this._isMode(consts_1.S_IFDIR);
    }
    isFile() {
        return this._isMode(consts_1.S_IFREG);
    }
    isBlockDevice() {
        return !consts_1.IS_WINDOWS && this._isMode(consts_1.S_IFBLK);
    }
    isCharacterDevice() {
        return this._isMode(consts_1.S_IFCHR);
    }
    isSymbolicLink() {
        return this._isMode(consts_1.S_IFLNK);
    }
    isFIFO() {
        return !consts_1.IS_WINDOWS && this._isMode(consts_1.S_IFIFO);
    }
    isSocket() {
        return !consts_1.IS_WINDOWS && this._isMode(consts_1.S_IFSOCK);
    }
}
/* EXPORT */
exports.default = Stats;
