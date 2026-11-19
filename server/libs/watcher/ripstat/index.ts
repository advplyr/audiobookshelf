/* IMPORT */
import fs from "../atomically/utils/fs";
import { toNamespacedPath } from "node:path";
import { RETRY_TIMEOUT } from "./consts";
import StatsRuntime from "./stats";

export const Stats = StatsRuntime;

interface NativeStatRequest {
    oncomplete?: (error: NodeJS.ErrnoException | null, data: BigInt64Array) => void;
}

interface NativeFsBinding {
    stat(this: void, path: string, bigint: true, request: NativeStatRequest): void;
    FSReqCallback: new (bigint: true) => NativeStatRequest;
}

/* HELPERS */
// ripstat uses Node's raw stat request to avoid allocating the standard Stats object.
const { stat, FSReqCallback } = (process as NodeJS.Process & { binding(name: 'fs'): NativeFsBinding }).binding('fs');

/* RIPSTAT */
const ripstat = (filePath: string, timeout?: number) => {
    return new Promise<StatsRuntime>((resolve, reject) => {
        const req = new FSReqCallback(true);
        req.oncomplete = (error, statsdata) => {
            if (error) {
                const { code } = error;
                if (code === 'EMFILE' || code === 'ENFILE' || code === 'EAGAIN' || code === 'EBUSY' || code === 'EACCESS' || code === 'EACCS' || code === 'EPERM') { // Retriable error
                    void fs.statRetry(timeout || RETRY_TIMEOUT)(filePath, { bigint: true }).then(nstats => {
                        const statsdata = [nstats.dev, nstats.mode, nstats.nlink, nstats.uid, nstats.gid, nstats.rdev, nstats.blksize, nstats.ino, nstats.size, nstats.blocks, 0n, nstats.atimeNs, 0n, nstats.mtimeNs, 0n, nstats.ctimeNs, 0n, nstats.birthtimeNs];
                        const stats = new StatsRuntime(statsdata);
                        resolve(stats);
                    }, reject);
                }
                else {
                    reject(error);
                }
            }
            else {
                const stats = new StatsRuntime(statsdata);
                resolve(stats);
            }
        };
        stat(toNamespacedPath(filePath), true, req);
    });
};
/* EXPORT */
export default ripstat;
