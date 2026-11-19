/* IMPORT */
import * as constants from "./consts";
/* HELPERS */
const { floor } = Math;
const toNumber = Number;
/* STATS */
class Stats {
    declare dev: number;
    declare mode: number;
    declare nlink: number;
    declare uid: number;
    declare gid: number;
    declare rdev: number;
    declare blksize: number;
    declare ino: number | bigint;
    declare size: number;
    declare blocks: number;
    declare atimeMs: number;
    declare mtimeMs: number;
    declare ctimeMs: number;
    declare birthtimeMs: number;

    /* CONSTRUCTOR */
    constructor(stats: ArrayLike<number | bigint>) {
        this.dev = toNumber(stats[0]);
        this.mode = toNumber(stats[1]);
        this.nlink = toNumber(stats[2]);
        this.uid = toNumber(stats[3]);
        this.gid = toNumber(stats[4]);
        this.rdev = toNumber(stats[5]);
        this.blksize = toNumber(stats[6]);
        this.ino = (stats[7] <= constants.MAX_SAFE_INTEGER) ? toNumber(stats[7]) : stats[7];
        this.size = toNumber(stats[8]);
        this.blocks = toNumber(stats[9]);
        this.atimeMs = (toNumber(stats[10]) * 1000) + floor(toNumber(stats[11]) / 1000000);
        this.mtimeMs = (toNumber(stats[12]) * 1000) + floor(toNumber(stats[13]) / 1000000);
        this.ctimeMs = (toNumber(stats[14]) * 1000) + floor(toNumber(stats[15]) / 1000000);
        this.birthtimeMs = (toNumber(stats[16]) * 1000) + floor(toNumber(stats[17]) / 1000000);
    }
    /* HELPERS */
    _isMode(mode: number) {
        return (this.mode & constants.S_IFMT) === mode;
    }
    /* API */
    isDirectory() {
        return this._isMode(constants.S_IFDIR);
    }
    isFile() {
        return this._isMode(constants.S_IFREG);
    }
    isBlockDevice() {
        return !constants.IS_WINDOWS && this._isMode(constants.S_IFBLK);
    }
    isCharacterDevice() {
        return this._isMode(constants.S_IFCHR);
    }
    isSymbolicLink() {
        return this._isMode(constants.S_IFLNK);
    }
    isFIFO() {
        return !constants.IS_WINDOWS && this._isMode(constants.S_IFIFO);
    }
    isSocket() {
        return !constants.IS_WINDOWS && this._isMode(constants.S_IFSOCK);
    }
}
/* EXPORT */
export default Stats;
