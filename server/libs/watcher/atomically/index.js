"use strict";
/* IMPORT */
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeFileSync = exports.writeFile = exports.readFileSync = exports.readFile = void 0;
const path = require("path");
const consts_1 = require("./consts");
const fs_1 = require("./utils/fs");
const lang_1 = require("./utils/lang");
const scheduler_1 = require("./utils/scheduler");
const temp_1 = require("./utils/temp");
function readFile(filePath, options = consts_1.DEFAULT_READ_OPTIONS) {
    var _a;
    if (lang_1.default.isString(options))
        return readFile(filePath, { encoding: options });
    const timeout = Date.now() + ((_a = options.timeout) !== null && _a !== void 0 ? _a : consts_1.DEFAULT_TIMEOUT_ASYNC);
    return fs_1.default.readFileRetry(timeout)(filePath, options);
}
exports.readFile = readFile;
;
function readFileSync(filePath, options = consts_1.DEFAULT_READ_OPTIONS) {
    var _a;
    if (lang_1.default.isString(options))
        return readFileSync(filePath, { encoding: options });
    const timeout = Date.now() + ((_a = options.timeout) !== null && _a !== void 0 ? _a : consts_1.DEFAULT_TIMEOUT_SYNC);
    return fs_1.default.readFileSyncRetry(timeout)(filePath, options);
}
exports.readFileSync = readFileSync;
;
const writeFile = (filePath, data, options, callback) => {
    if (lang_1.default.isFunction(options))
        return writeFile(filePath, data, consts_1.DEFAULT_WRITE_OPTIONS, options);
    const promise = writeFileAsync(filePath, data, options);
    if (callback)
        promise.then(callback, callback);
    return promise;
};
exports.writeFile = writeFile;
const writeFileAsync = async (filePath, data, options = consts_1.DEFAULT_WRITE_OPTIONS) => {
    var _a;
    if (lang_1.default.isString(options))
        return writeFileAsync(filePath, data, { encoding: options });
    const timeout = Date.now() + ((_a = options.timeout) !== null && _a !== void 0 ? _a : consts_1.DEFAULT_TIMEOUT_ASYNC);
    let schedulerCustomDisposer = null, schedulerDisposer = null, tempDisposer = null, tempPath = null, fd = null;
    try {
        if (options.schedule)
            schedulerCustomDisposer = await options.schedule(filePath);
        schedulerDisposer = await scheduler_1.default.schedule(filePath);
        filePath = await fs_1.default.realpathAttempt(filePath) || filePath;
        [tempPath, tempDisposer] = temp_1.default.get(filePath, options.tmpCreate || temp_1.default.create, !(options.tmpPurge === false));
        const useStatChown = consts_1.IS_POSIX && lang_1.default.isUndefined(options.chown), useStatMode = lang_1.default.isUndefined(options.mode);
        if (useStatChown || useStatMode) {
            const stat = await fs_1.default.statAttempt(filePath);
            if (stat) {
                options = { ...options };
                if (useStatChown)
                    options.chown = { uid: stat.uid, gid: stat.gid };
                if (useStatMode)
                    options.mode = stat.mode;
            }
        }
        const parentPath = path.dirname(filePath);
        await fs_1.default.mkdirAttempt(parentPath, {
            mode: consts_1.DEFAULT_FOLDER_MODE,
            recursive: true
        });
        fd = await fs_1.default.openRetry(timeout)(tempPath, 'w', options.mode || consts_1.DEFAULT_FILE_MODE);
        if (options.tmpCreated)
            options.tmpCreated(tempPath);
        if (lang_1.default.isString(data)) {
            await fs_1.default.writeRetry(timeout)(fd, data, 0, options.encoding || consts_1.DEFAULT_ENCODING);
        }
        else if (!lang_1.default.isUndefined(data)) {
            await fs_1.default.writeRetry(timeout)(fd, data, 0, data.length, 0);
        }
        if (options.fsync !== false) {
            if (options.fsyncWait !== false) {
                await fs_1.default.fsyncRetry(timeout)(fd);
            }
            else {
                fs_1.default.fsyncAttempt(fd);
            }
        }
        await fs_1.default.closeRetry(timeout)(fd);
        fd = null;
        if (options.chown)
            await fs_1.default.chownAttempt(tempPath, options.chown.uid, options.chown.gid);
        if (options.mode)
            await fs_1.default.chmodAttempt(tempPath, options.mode);
        try {
            await fs_1.default.renameRetry(timeout)(tempPath, filePath);
        }
        catch (error) {
            if (error.code !== 'ENAMETOOLONG')
                throw error;
            await fs_1.default.renameRetry(timeout)(tempPath, temp_1.default.truncate(filePath));
        }
        tempDisposer();
        tempPath = null;
    }
    finally {
        if (fd)
            await fs_1.default.closeAttempt(fd);
        if (tempPath)
            temp_1.default.purge(tempPath);
        if (schedulerCustomDisposer)
            schedulerCustomDisposer();
        if (schedulerDisposer)
            schedulerDisposer();
    }
};
const writeFileSync = (filePath, data, options = consts_1.DEFAULT_WRITE_OPTIONS) => {
    var _a;
    if (lang_1.default.isString(options))
        return writeFileSync(filePath, data, { encoding: options });
    const timeout = Date.now() + ((_a = options.timeout) !== null && _a !== void 0 ? _a : consts_1.DEFAULT_TIMEOUT_SYNC);
    let tempDisposer = null, tempPath = null, fd = null;
    try {
        filePath = fs_1.default.realpathSyncAttempt(filePath) || filePath;
        [tempPath, tempDisposer] = temp_1.default.get(filePath, options.tmpCreate || temp_1.default.create, !(options.tmpPurge === false));
        const useStatChown = consts_1.IS_POSIX && lang_1.default.isUndefined(options.chown), useStatMode = lang_1.default.isUndefined(options.mode);
        if (useStatChown || useStatMode) {
            const stat = fs_1.default.statSyncAttempt(filePath);
            if (stat) {
                options = { ...options };
                if (useStatChown)
                    options.chown = { uid: stat.uid, gid: stat.gid };
                if (useStatMode)
                    options.mode = stat.mode;
            }
        }
        const parentPath = path.dirname(filePath);
        fs_1.default.mkdirSyncAttempt(parentPath, {
            mode: consts_1.DEFAULT_FOLDER_MODE,
            recursive: true
        });
        fd = fs_1.default.openSyncRetry(timeout)(tempPath, 'w', options.mode || consts_1.DEFAULT_FILE_MODE);
        if (options.tmpCreated)
            options.tmpCreated(tempPath);
        if (lang_1.default.isString(data)) {
            fs_1.default.writeSyncRetry(timeout)(fd, data, 0, options.encoding || consts_1.DEFAULT_ENCODING);
        }
        else if (!lang_1.default.isUndefined(data)) {
            fs_1.default.writeSyncRetry(timeout)(fd, data, 0, data.length, 0);
        }
        if (options.fsync !== false) {
            if (options.fsyncWait !== false) {
                fs_1.default.fsyncSyncRetry(timeout)(fd);
            }
            else {
                fs_1.default.fsyncAttempt(fd);
            }
        }
        fs_1.default.closeSyncRetry(timeout)(fd);
        fd = null;
        if (options.chown)
            fs_1.default.chownSyncAttempt(tempPath, options.chown.uid, options.chown.gid);
        if (options.mode)
            fs_1.default.chmodSyncAttempt(tempPath, options.mode);
        try {
            fs_1.default.renameSyncRetry(timeout)(tempPath, filePath);
        }
        catch (error) {
            if (error.code !== 'ENAMETOOLONG')
                throw error;
            fs_1.default.renameSyncRetry(timeout)(tempPath, temp_1.default.truncate(filePath));
        }
        tempDisposer();
        tempPath = null;
    }
    finally {
        if (fd)
            fs_1.default.closeSyncAttempt(fd);
        if (tempPath)
            temp_1.default.purge(tempPath);
    }
};
exports.writeFileSync = writeFileSync;
