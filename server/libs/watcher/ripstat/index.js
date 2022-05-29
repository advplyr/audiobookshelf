"use strict";
/* IMPORT */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Stats = void 0;
const fs_1 = require("../atomically/utils/fs");
const path_1 = require("path");
const consts_1 = require("./consts");
const stats_1 = require("./stats");
exports.Stats = stats_1.default;
/* HELPERS */
const { stat, FSReqCallback } = process['binding']('fs');
/* RIPSTAT */
const ripstat = (filePath, timeout) => {
    return new Promise((resolve, reject) => {
        const req = new FSReqCallback(true);
        req.oncomplete = (error, statsdata) => {
            if (error) {
                const { code } = error;
                if (code === 'EMFILE' || code === 'ENFILE' || code === 'EAGAIN' || code === 'EBUSY' || code === 'EACCESS' || code === 'EACCS' || code === 'EPERM') { // Retriable error
                    fs_1.default.statRetry(timeout || consts_1.RETRY_TIMEOUT)(filePath, { bigint: true }).then(nstats => {
                        const statsdata = [nstats.dev, nstats.mode, nstats.nlink, nstats.uid, nstats.gid, nstats.rdev, nstats.blksize, nstats.ino, nstats.size, nstats.blocks, 0n, nstats.atimeNs, 0n, nstats.mtimeNs, 0n, nstats.ctimeNs, 0n, nstats.birthtimeNs];
                        const stats = new stats_1.default(statsdata);
                        resolve(stats);
                    }, reject);
                }
                else {
                    reject(error);
                }
            }
            else {
                const stats = new stats_1.default(statsdata);
                resolve(stats);
            }
        };
        stat(path_1.toNamespacedPath(filePath), true, req);
    });
};
/* EXPORT */
exports.default = ripstat;
