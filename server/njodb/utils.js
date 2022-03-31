"use strict";

const {
    access,
    constants,
    existsSync,
    rename,
    renameSync,
    rmdir,
    rmdirSync,
    unlink,
    unlinkSync
} = require("graceful-fs");

const { promisify } = require("util");

const min = (a, b) => {
    if (b === undefined || a <= b) return a;
    return b;
};

const max = (a, b) => {
    if (b === undefined || a > b) return a;
    return b;
};

const convertSize = (size) => {
    const sizes = ["bytes", "KB", "MB", "GB"];

    var index = Math.floor(Math.log2(size)/10);
    if (index > 3) index = 3;

    return Math.round(((size / Math.pow(1024, index)) + Number.EPSILON) * 100) / 100 + " " + sizes[index];
};

const fileExists = async (a) => {
    try {
        await promisify(access)(a, constants.F_OK);
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
}

const fileExistsSync = (a) => {
    try {
        return existsSync(a);
    } catch (error) {
        console.error(error);
        return false;
    }
}

const moveFile = async (a, b) => {
    try {
        await promisify(rename)(a, b);
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
};

const moveFileSync = (a, b) => {
    try {
        renameSync(a, b);
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
};

const deleteFile = async (filepath) => {
    try {
        await promisify(unlink)(filepath);
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
};

const deleteFileSync = (filepath) => {
    try {
        unlinkSync(filepath);
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
}

const replaceFile = async (a, b) => {
    if (!await moveFile(a, a + ".old")) return false;

    if (!await moveFile(b, a)) {
        await moveFile(a + ".old", a);
        return false;
    }

    await deleteFile(a + ".old");

    return true;
};

const replaceFileSync = (a, b) => {
    if (!moveFileSync(a, a + ".old")) return false;

    if (!moveFileSync(b, a)) {
        moveFile(a + ".old", a);
        return false;
    }

    deleteFileSync(a + ".old");

    return true;
};

const deleteDirectory = async (dirpath) => {
    try {
        await promisify(rmdir)(dirpath);
        return true;
    } catch {
        return false;
    }
};

const deleteDirectorySync = (dirpath) => {
    try {
        rmdirSync(dirpath);
        return true;
    } catch {
        return false;
    }
};

const releaseLock = async (store, release) => {
    try {
        await release();
    } catch (error) {
        if (!["ERELEASED", "ENOTACQUIRED"].includes(error.code)) {
            error.store = store;
            throw error;
        }
    }
}

const releaseLockSync = (store, release) => {
    try {
        release();
    } catch (error) {
        if (!["ERELEASED", "ENOTACQUIRED"].includes(error.code)) {
            error.store = store;
            throw error;
        }
    }
}

exports.min = min;
exports.max = max;

exports.convertSize = convertSize;

exports.fileExists = fileExists;
exports.fileExistsSync = fileExistsSync;
exports.moveFile = moveFile;
exports.moveFileSync = moveFileSync;
exports.replaceFile = replaceFile;
exports.replaceFileSync = replaceFileSync;
exports.deleteFile = deleteFile;
exports.deleteFileSync = deleteFileSync;
exports.deleteDirectory = deleteDirectory;
exports.deleteDirectorySync = deleteDirectorySync;

exports.releaseLock = releaseLock;
exports.releaseLockSync = releaseLockSync;