"use strict";
/* IMPORT */
const fs = require("fs");
const path = require("path");
const promise_concurrency_limiter_1 = require("./promise-concurrency-limiter");
/* HELPERS */
const limiter = new promise_concurrency_limiter_1.default({ concurrency: 500 });
/* TINY READDIR */
const readdir = (rootPath, options) => {
    var _a, _b, _c, _d;
    const followSymlinks = (_a = options === null || options === void 0 ? void 0 : options.followSymlinks) !== null && _a !== void 0 ? _a : false, maxDepth = (_b = options === null || options === void 0 ? void 0 : options.depth) !== null && _b !== void 0 ? _b : Infinity, isIgnored = (_c = options === null || options === void 0 ? void 0 : options.ignore) !== null && _c !== void 0 ? _c : (() => false), signal = (_d = options === null || options === void 0 ? void 0 : options.signal) !== null && _d !== void 0 ? _d : { aborted: false }, directories = [], files = [], symlinks = [], map = {}, resultEmpty = { directories: [], files: [], symlinks: [], map: {} }, result = { directories, files, symlinks, map };
    const handleDirectory = (dirmap, subPath, depth) => {
        dirmap.directories.push(subPath);
        directories.push(subPath);
        if (depth >= maxDepth)
            return;

        // if depth > 1 and the limiter is full, then we cannot queue this function or the current promise will never return
        if (depth > 1 && limiter.count >= limiter.concurrency) return populateResultFromPath(subPath, depth + 1)

        return limiter.add(() => populateResultFromPath(subPath, depth + 1));
    };
    const handleFile = (dirmap, subPath) => {
        dirmap.files.push(subPath);
        files.push(subPath);
    };
    const handleSymlink = (dirmap, subPath, depth) => {
        dirmap.symlinks.push(subPath);
        symlinks.push(subPath);
        if (!followSymlinks)
            return;
        if (depth >= maxDepth)
            return;
        return limiter.add(() => populateResultFromSymlink(subPath, depth + 1));
    };
    const handleStat = (dirmap, rootPath, stat, depth) => {
        if (signal.aborted)
            return;
        if (isIgnored(rootPath))
            return;
        if (stat.isDirectory()) {
            return handleDirectory(dirmap, rootPath, depth);
        }
        else if (stat.isFile()) {
            return handleFile(dirmap, rootPath);
        }
        else if (stat.isSymbolicLink()) {
            return handleSymlink(dirmap, rootPath, depth);
        }
    };
    const handleDirent = (dirmap, rootPath, dirent, depth) => {
        if (signal.aborted)
            return;
        const subPath = `${rootPath}${path.sep}${dirent.name}`;
        if (isIgnored(subPath))
            return;
        if (dirent.isDirectory()) {
            return handleDirectory(dirmap, subPath, depth);
        }
        else if (dirent.isFile()) {
            return handleFile(dirmap, subPath);
        }
        else if (dirent.isSymbolicLink()) {
            return handleSymlink(dirmap, subPath, depth);
        }
    };
    const handleDirents = (dirmap, rootPath, dirents, depth) => {
        return Promise.all(dirents.map((dirent) => {
            return handleDirent(dirmap, rootPath, dirent, depth);
        }));
    };
    const populateResultFromPath = async (rootPath, depth) => {
        if (signal.aborted)
            return;
        if (depth > maxDepth)
            return;
        const dirents = await fs.promises.readdir(rootPath, { withFileTypes: true }).catch(() => []);
        if (signal.aborted)
            return;
        const dirmap = map[rootPath] = { directories: [], files: [], symlinks: [] };
        if (!dirents.length)
            return;
        await handleDirents(dirmap, rootPath, dirents, depth);
    };
    const populateResultFromSymlink = async (rootPath, depth) => {
        try {
            const realPath = await fs.promises.realpath(rootPath), stat = await fs.promises.stat(realPath), dirmap = map[rootPath] = { directories: [], files: [], symlinks: [] };
            await handleStat(dirmap, realPath, stat, depth);
        }
        catch (_a) { }
    };
    const getResult = async (rootPath, depth = 1) => {
        rootPath = path.normalize(rootPath);
        await populateResultFromPath(rootPath, depth);
        if (signal.aborted)
            return resultEmpty;
        return result;
    };
    return getResult(rootPath);
};
/* EXPORT */
module.exports = readdir;
module.exports.default = readdir;
Object.defineProperty(module.exports, "__esModule", { value: true });
