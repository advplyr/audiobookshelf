/* IMPORT */
import path from "node:path";
import type { Mode, PathOrFileDescriptor } from "node:fs";
import {
    DEFAULT_ENCODING,
    DEFAULT_FILE_MODE,
    DEFAULT_FOLDER_MODE,
    DEFAULT_READ_OPTIONS,
    DEFAULT_TIMEOUT_ASYNC,
    DEFAULT_TIMEOUT_SYNC,
    DEFAULT_WRITE_OPTIONS,
    IS_POSIX
} from "./consts";
import FS from "./utils/fs";
import Lang from "./utils/lang";
import Scheduler from "./utils/scheduler";
import Temp from "./utils/temp";

interface ReadOptions {
    encoding?: BufferEncoding | null;
    flag?: string;
    signal?: AbortSignal;
    timeout?: number;
}

type Dispose = () => void;
type WriteCallback = (result: unknown) => void;
type WriteData = string | (NodeJS.ArrayBufferView & { length?: number });

interface WriteOptions {
    encoding?: BufferEncoding;
    timeout?: number;
    schedule?: (path: string) => void | Dispose | Promise<void | Dispose>;
    tmpCreate?: (path: string) => string;
    tmpCreated?: (path: string) => void;
    tmpPurge?: boolean;
    chown?: { uid: number; gid: number } | false | null;
    mode?: Mode | null;
    fsync?: boolean;
    fsyncWait?: boolean;
}

export function readFile(filePath: PathOrFileDescriptor, options: BufferEncoding | (ReadOptions & { encoding: BufferEncoding })): Promise<string>;
export function readFile(filePath: PathOrFileDescriptor, options?: ReadOptions & { encoding?: null }): Promise<Buffer>;
export function readFile(filePath: PathOrFileDescriptor, options: ReadOptions | BufferEncoding): Promise<string | Buffer>;
export function readFile(filePath: PathOrFileDescriptor, options: ReadOptions | BufferEncoding = DEFAULT_READ_OPTIONS): Promise<string | Buffer> {
    if (Lang.isString(options))
        return readFile(filePath, { encoding: options });
    const timeout = Date.now() + (options.timeout ?? DEFAULT_TIMEOUT_ASYNC);
    return FS.readFileRetry(timeout)(filePath, options);
}

export function readFileSync(filePath: PathOrFileDescriptor, options: BufferEncoding | (ReadOptions & { encoding: BufferEncoding })): string;
export function readFileSync(filePath: PathOrFileDescriptor, options?: ReadOptions & { encoding?: null }): Buffer;
export function readFileSync(filePath: PathOrFileDescriptor, options: ReadOptions | BufferEncoding): string | Buffer;
export function readFileSync(filePath: PathOrFileDescriptor, options: ReadOptions | BufferEncoding = DEFAULT_READ_OPTIONS): string | Buffer {
    if (Lang.isString(options))
        return readFileSync(filePath, { encoding: options });
    const timeout = Date.now() + (options.timeout ?? DEFAULT_TIMEOUT_SYNC);
    return FS.readFileSyncRetry(timeout)(filePath, options);
}

export const writeFile = (filePath: string, data?: WriteData, options?: WriteOptions | BufferEncoding | WriteCallback, callback?: WriteCallback): Promise<void> => {
    if (Lang.isFunction(options))
        return writeFile(filePath, data, DEFAULT_WRITE_OPTIONS, options);
    const promise = writeFileAsync(filePath, data, options);
    if (callback)
        void promise.then(callback, callback);
    return promise;
};
const writeFileAsync = async (filePath: string, data: WriteData | undefined, options: WriteOptions | BufferEncoding = DEFAULT_WRITE_OPTIONS): Promise<void> => {
    if (Lang.isString(options))
        return writeFileAsync(filePath, data, { encoding: options });
    const timeout = Date.now() + (options.timeout ?? DEFAULT_TIMEOUT_ASYNC);
    let schedulerCustomDisposer: void | Dispose | null = null;
    let schedulerDisposer: Dispose | undefined;
    let tempDisposer: Dispose;
    let tempPath: string | null = null;
    let fd: number | null = null;
    try {
        if (options.schedule)
            schedulerCustomDisposer = await options.schedule(filePath);
        schedulerDisposer = await Scheduler.schedule(filePath);
        filePath = await FS.realpathAttempt(filePath) || filePath;
        [tempPath, tempDisposer] = Temp.get(filePath, options.tmpCreate || Temp.create, !(options.tmpPurge === false));
        const useStatChown = IS_POSIX && Lang.isUndefined(options.chown), useStatMode = Lang.isUndefined(options.mode);
        if (useStatChown || useStatMode) {
            const stat = await FS.statAttempt(filePath);
            if (stat) {
                options = { ...options };
                if (useStatChown)
                    options.chown = { uid: stat.uid, gid: stat.gid };
                if (useStatMode)
                    options.mode = stat.mode;
            }
        }
        const parentPath = path.dirname(filePath);
        await FS.mkdirAttempt(parentPath, {
            mode: DEFAULT_FOLDER_MODE,
            recursive: true
        });
        fd = await FS.openRetry(timeout)(tempPath, 'w', options.mode || DEFAULT_FILE_MODE);
        if (options.tmpCreated)
            options.tmpCreated(tempPath);
        if (Lang.isString(data)) {
            await FS.writeRetry(timeout)(fd, data, 0, options.encoding || DEFAULT_ENCODING);
        }
        else if (!Lang.isUndefined(data)) {
            await FS.writeRetry(timeout)(fd, data, 0, data.length, 0);
        }
        if (options.fsync !== false) {
            if (options.fsyncWait !== false) {
                await FS.fsyncRetry(timeout)(fd);
            }
            else {
                void FS.fsyncAttempt(fd);
            }
        }
        await FS.closeRetry(timeout)(fd);
        fd = null;
        if (options.chown)
            await FS.chownAttempt(tempPath, options.chown.uid, options.chown.gid);
        if (options.mode)
            await FS.chmodAttempt(tempPath, options.mode);
        try {
            await FS.renameRetry(timeout)(tempPath, filePath);
        }
        catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENAMETOOLONG')
                throw error;
            await FS.renameRetry(timeout)(tempPath, Temp.truncate(filePath));
        }
        tempDisposer();
        tempPath = null;
    }
    finally {
        if (fd)
            await FS.closeAttempt(fd);
        if (tempPath)
            Temp.purge(tempPath);
        if (schedulerCustomDisposer)
            schedulerCustomDisposer();
        if (schedulerDisposer)
            schedulerDisposer();
    }
};
export const writeFileSync = (filePath: string, data?: WriteData, options: WriteOptions | BufferEncoding = DEFAULT_WRITE_OPTIONS): void => {
    if (Lang.isString(options))
        return writeFileSync(filePath, data, { encoding: options });
    const timeout = Date.now() + (options.timeout ?? DEFAULT_TIMEOUT_SYNC);
    let tempDisposer: Dispose;
    let tempPath: string | null = null;
    let fd: number | null = null;
    try {
        filePath = FS.realpathSyncAttempt(filePath) || filePath;
        [tempPath, tempDisposer] = Temp.get(filePath, options.tmpCreate || Temp.create, !(options.tmpPurge === false));
        const useStatChown = IS_POSIX && Lang.isUndefined(options.chown), useStatMode = Lang.isUndefined(options.mode);
        if (useStatChown || useStatMode) {
            const stat = FS.statSyncAttempt(filePath);
            if (stat) {
                options = { ...options };
                if (useStatChown)
                    options.chown = { uid: stat.uid, gid: stat.gid };
                if (useStatMode)
                    options.mode = stat.mode;
            }
        }
        const parentPath = path.dirname(filePath);
        FS.mkdirSyncAttempt(parentPath, {
            mode: DEFAULT_FOLDER_MODE,
            recursive: true
        });
        fd = FS.openSyncRetry(timeout)(tempPath, 'w', options.mode || DEFAULT_FILE_MODE);
        if (options.tmpCreated)
            options.tmpCreated(tempPath);
        if (Lang.isString(data)) {
            FS.writeSyncRetry(timeout)(fd, data, 0, options.encoding || DEFAULT_ENCODING);
        }
        else if (!Lang.isUndefined(data)) {
            FS.writeSyncRetry(timeout)(fd, data, 0, data.length, 0);
        }
        if (options.fsync !== false) {
            if (options.fsyncWait !== false) {
                FS.fsyncSyncRetry(timeout)(fd);
            }
            else {
                void FS.fsyncAttempt(fd);
            }
        }
        FS.closeSyncRetry(timeout)(fd);
        fd = null;
        if (options.chown)
            FS.chownSyncAttempt(tempPath, options.chown.uid, options.chown.gid);
        if (options.mode)
            FS.chmodSyncAttempt(tempPath, options.mode);
        try {
            FS.renameSyncRetry(timeout)(tempPath, filePath);
        }
        catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENAMETOOLONG')
                throw error;
            FS.renameSyncRetry(timeout)(tempPath, Temp.truncate(filePath));
        }
        tempDisposer();
        tempPath = null;
    }
    finally {
        if (fd)
            FS.closeSyncAttempt(fd);
        if (tempPath)
            Temp.purge(tempPath);
    }
};
