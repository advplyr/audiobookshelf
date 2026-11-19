/* IMPORT */
import fs from "node:fs";
import type { Dirent, Stats } from "node:fs";
import path from "node:path";
import Limiter from "./promise-concurrency-limiter";

interface ReaddirOptions {
    followSymlinks?: boolean;
    depth?: number;
    ignore?: (path: string) => unknown;
    signal?: { aborted: boolean };
}

interface DirectoryEntries {
    directories: string[];
    files: string[];
    symlinks: string[];
}

interface ReaddirResult extends DirectoryEntries {
    map: Record<string, DirectoryEntries>;
}

/* HELPERS */
const limiter = new Limiter({ concurrency: 500 });
/* TINY READDIR */
const readdir = (rootPath: string, options?: ReaddirOptions): Promise<ReaddirResult> => {
    const followSymlinks = options?.followSymlinks ?? false;
    const maxDepth = options?.depth ?? Infinity;
    const isIgnored = options?.ignore ?? (() => false);
    const signal = options?.signal ?? { aborted: false };
    const directories: string[] = [];
    const files: string[] = [];
    const symlinks: string[] = [];
    const map: ReaddirResult["map"] = {};
    const resultEmpty: ReaddirResult = { directories: [], files: [], symlinks: [], map: {} };
    const result: ReaddirResult = { directories, files, symlinks, map };
    const handleDirectory = (dirmap: DirectoryEntries, subPath: string, depth: number): void | Promise<void> => {
        dirmap.directories.push(subPath);
        directories.push(subPath);
        if (depth >= maxDepth)
            return;

        // if depth > 1 and the limiter is full, then we cannot queue this function or the current promise will never return
        if (depth > 1 && limiter.count >= limiter.concurrency) return populateResultFromPath(subPath, depth + 1)

        return limiter.add(() => populateResultFromPath(subPath, depth + 1));
    };
    const handleFile = (dirmap: DirectoryEntries, subPath: string) => {
        dirmap.files.push(subPath);
        files.push(subPath);
    };
    const handleSymlink = (dirmap: DirectoryEntries, subPath: string, depth: number): void | Promise<void> => {
        dirmap.symlinks.push(subPath);
        symlinks.push(subPath);
        if (!followSymlinks)
            return;
        if (depth >= maxDepth)
            return;
        return limiter.add(() => populateResultFromSymlink(subPath, depth + 1));
    };
    const handleStat = (dirmap: DirectoryEntries, rootPath: string, stat: Stats, depth: number) => {
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
    const handleDirent = (dirmap: DirectoryEntries, rootPath: string, dirent: Dirent, depth: number) => {
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
    const handleDirents = (dirmap: DirectoryEntries, rootPath: string, dirents: Dirent[], depth: number) => {
        return Promise.all(dirents.map((dirent) => {
            return Promise.resolve(handleDirent(dirmap, rootPath, dirent, depth));
        }));
    };
    const populateResultFromPath = async (rootPath: string, depth: number): Promise<void> => {
        if (signal.aborted)
            return;
        if (depth > maxDepth)
            return;
        const dirents = await fs.promises.readdir(rootPath, { withFileTypes: true }).catch(() => []);
        if (signal.aborted)
            return;
        const dirmap: DirectoryEntries = map[rootPath] = { directories: [], files: [], symlinks: [] };
        if (!dirents.length)
            return;
        await handleDirents(dirmap, rootPath, dirents, depth);
    };
    const populateResultFromSymlink = async (rootPath: string, depth: number): Promise<void> => {
        try {
            const realPath = await fs.promises.realpath(rootPath), stat = await fs.promises.stat(realPath), dirmap: DirectoryEntries = map[rootPath] = { directories: [], files: [], symlinks: [] };
            await handleStat(dirmap, realPath, stat, depth);
        }
        catch { /* The symlink target may have disappeared. */ }
    };
    const getResult = async (rootPath: string, depth = 1) => {
        rootPath = path.normalize(rootPath);
        await populateResultFromPath(rootPath, depth);
        if (signal.aborted)
            return resultEmpty;
        return result;
    };
    return getResult(rootPath);
};
/* EXPORT */
const exported = Object.assign(readdir, { default: readdir });
Object.defineProperty(exported, "__esModule", { value: true });

export = exported;
