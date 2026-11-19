import type Stats from "./ripstat/stats";

/* WATCHER STATS */
// An even more memory-efficient representation of the useful subset of stats objects
class WatcherStats {
    declare ino: number | bigint;
    declare size: number;
    declare atimeMs: number;
    declare mtimeMs: number;
    declare ctimeMs: number;
    declare birthtimeMs: number;
    declare private _isFile: boolean;
    declare private _isDirectory: boolean;
    declare private _isSymbolicLink: boolean;

    /* CONSTRUCTOR */
    constructor(stats: Pick<Stats, "ino" | "size" | "atimeMs" | "mtimeMs" | "ctimeMs" | "birthtimeMs" | "isFile" | "isDirectory" | "isSymbolicLink">) {
        this.ino = stats.ino;
        this.size = stats.size;
        this.atimeMs = stats.atimeMs;
        this.mtimeMs = stats.mtimeMs;
        this.ctimeMs = stats.ctimeMs;
        this.birthtimeMs = stats.birthtimeMs;
        this._isFile = stats.isFile();
        this._isDirectory = stats.isDirectory();
        this._isSymbolicLink = stats.isSymbolicLink();
    }
    /* API */
    isFile() {
        return this._isFile;
    }
    isDirectory() {
        return this._isDirectory;
    }
    isSymbolicLink() {
        return this._isSymbolicLink;
    }
}
/* EXPORT */
export default WatcherStats;
