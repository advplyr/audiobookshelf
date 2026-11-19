/* IMPORT */
import AbortController from "./aborter/controller";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import stringIndexes from "./string-indexes";
import { DEPTH, HAS_NATIVE_RECURSION, POLLING_INTERVAL } from "./constants";
import WatcherHandler from "./watcher_handler";
import WatcherLocker from "./watcher_locker";
import WatcherPoller from "./watcher_poller";
import Utils from "./utils";
import type { PollEvent, RenameEvent, WatchEvent } from "./enums";
import type { IgnorePath, WatcherConfig, WatcherOptions, WatchHandler } from "./types";

type Target = string | string[];
type WatcherEvents = Record<PollEvent, [targetPath: string, nextPath?: string]>
    & Record<RenameEvent, [from: string, to: string]>
    & {
        all: Parameters<WatchHandler>;
        ready: [];
        close: [];
        error: [error: Error];
    };

interface TargetConfig {
    targetPath: string;
    options: WatcherOptions;
}

/* WATCHER */
class Watcher extends EventEmitter<WatcherEvents> {
    declare _closed: boolean;
    declare _ready: boolean;
    declare _closeAborter: InstanceType<typeof AbortController>;
    declare _closeSignal: InstanceType<typeof AbortController>["signal"];
    declare _closeWait: Promise<void>;
    declare _readyWait: Promise<void>;
    declare _locker: WatcherLocker;
    declare _roots: Set<string>;
    declare _poller: WatcherPoller;
    declare _pollers: Set<TargetConfig>;
    declare _subwatchers: Set<TargetConfig>;
    declare _watchers: Partial<Record<string, WatcherConfig[]>>;
    declare _watchersLock: Promise<void>;
    declare _watchersRestorable: Record<string, WatcherConfig>;
    declare _watchersRestoreTimeout?: NodeJS.Timeout;

    /* CONSTRUCTOR */
    constructor(target?: Target | WatchHandler, options?: WatcherOptions | WatchHandler, handler?: WatchHandler) {
        super();
        this._closed = false;
        this._ready = false;
        this._closeAborter = new AbortController();
        this._closeSignal = this._closeAborter.signal;
        this.on("close" /* CLOSE */, () => this._closeAborter.abort());
        this._closeWait = new Promise(resolve => this.on("close" /* CLOSE */, resolve));
        this._readyWait = new Promise(resolve => this.on("ready" /* READY */, resolve));
        this._locker = new WatcherLocker(this);
        this._roots = new Set();
        this._poller = new WatcherPoller();
        this._pollers = new Set();
        this._subwatchers = new Set();
        this._watchers = {};
        this._watchersLock = Promise.resolve();
        this._watchersRestorable = {};
        void this.watch(target, options, handler);
    }
    /* API */
    isClosed() {
        return this._closed;
    }
    isIgnored(targetPath: string, ignore?: IgnorePath) {
        return !!ignore && !!ignore(targetPath);
    }
    isReady() {
        return this._ready;
    }
    close() {
        this._locker.reset();
        this._poller.reset();
        this._roots.clear();
        this.watchersClose();
        if (this.isClosed())
            return false;
        this._closed = true;
        return this.emit("close" /* CLOSE */);
    }
    error(exception: unknown) {
        if (this.isClosed())
            return false;
        const error = Utils.lang.castError(exception);
        return this.emit("error" /* ERROR */, error);
    }
    event(event: PollEvent, targetPath: string, targetPathNext?: string): boolean;
    event(event: RenameEvent, targetPath: string, targetPathNext: string): boolean;
    event(event: WatchEvent, targetPath: string, targetPathNext?: string) {
        if (this.isClosed())
            return false;
        this.emit("all" /* ALL */, event, targetPath, targetPathNext);
        return this.emit(event, targetPath, targetPathNext);
    }
    ready() {
        if (this.isClosed() || this.isReady())
            return false;
        this._ready = true;
        return this.emit("ready" /* READY */);
    }
    pollerExists(targetPath: string, options: WatcherOptions) {
        for (const poller of this._pollers) {
            if (poller.targetPath !== targetPath)
                continue;
            if (!Utils.lang.areShallowEqual(poller.options, options))
                continue;
            return true;
        }
        return false;
    }
    subwatcherExists(targetPath: string, options: WatcherOptions) {
        for (const subwatcher of this._subwatchers) {
            if (subwatcher.targetPath !== targetPath)
                continue;
            if (!Utils.lang.areShallowEqual(subwatcher.options, options))
                continue;
            return true;
        }
        return false;
    }
    watchersClose(folderPath?: string, filePath?: string, recursive = true) {
        if (!folderPath) {
            for (const folderPath in this._watchers) {
                this.watchersClose(folderPath, filePath, false);
            }
        }
        else {
            const configs = this._watchers[folderPath];
            if (configs) {
                for (const config of configs) {
                    if (filePath && config.filePath !== filePath)
                        continue;
                    this.watcherClose(config);
                }
            }
            if (recursive) {
                for (const folderPathOther in this._watchers) {
                    if (!Utils.fs.isSubPath(folderPath, folderPathOther))
                        continue;
                    this.watchersClose(folderPathOther, filePath, false);
                }
            }
        }
    }
    watchersLock(callback: () => Promise<unknown>): Promise<void> {
        return this._watchersLock.then(() => {
            return this._watchersLock = new Promise<void>(resolve => {
                void (async () => {
                    await callback();
                    resolve();
                })();
            });
        });
    }
    watchersRestore() {
        delete this._watchersRestoreTimeout;
        const watchers = Object.entries(this._watchersRestorable);
        this._watchersRestorable = {};
        for (const [targetPath, config] of watchers) {
            void this.watchPath(targetPath, config.options, config.handler);
        }
    }
    async watcherAdd(config: WatcherConfig, baseWatcherHandler?: WatcherHandler) {
        const { folderPath } = config;
        const configs = this._watchers[folderPath] = (this._watchers[folderPath] || []);
        configs.push(config);
        const watcherHandler = new WatcherHandler(this, config, baseWatcherHandler);
        await watcherHandler.init();
        return watcherHandler;
    }
    watcherClose(config: WatcherConfig) {
        config.watcher.close();
        const configs = this._watchers[config.folderPath];
        if (configs) {
            const index = configs.indexOf(config);
            configs.splice(index, 1);
            if (!configs.length) {
                delete this._watchers[config.folderPath];
            }
        }
        const rootPath = config.filePath || config.folderPath, isRoot = this._roots.has(rootPath);
        if (isRoot) {
            this._watchersRestorable[rootPath] = config;
            if (!this._watchersRestoreTimeout) {
                this._watchersRestoreTimeout = Utils.lang.defer(() => this.watchersRestore());
            }
        }
    }
    watcherExists(folderPath: string, options: WatcherOptions, handler: WatchHandler, filePath?: string) {
        const configsSibling = this._watchers[folderPath];
        if (!!(configsSibling === null || configsSibling === void 0 ? void 0 : configsSibling.find(config => config.handler === handler && (!config.filePath || config.filePath === filePath) && config.options.ignore === options.ignore && !!config.options.native === !!options.native && (!options.recursive || config.options.recursive))))
            return true;
        let folderAncestorPath = path.dirname(folderPath);
        for (let depth = 1; depth < Infinity; depth++) {
            const configsAncestor = this._watchers[folderAncestorPath];
            if (!!(configsAncestor === null || configsAncestor === void 0 ? void 0 : configsAncestor.find(config => { var _a; return (depth === 1 || (config.options.recursive && depth <= ((_a = config.options.depth) !== null && _a !== void 0 ? _a : DEPTH))) && config.handler === handler && (!config.filePath || config.filePath === filePath) && config.options.ignore === options.ignore && !!config.options.native === !!options.native && (!options.recursive || (config.options.recursive && (HAS_NATIVE_RECURSION && config.options.native !== false))); })))
                return true;
            if (!HAS_NATIVE_RECURSION)
                break; // No other ancestor will possibly be found
            const folderAncestorPathNext = path.dirname(folderPath);
            if (folderAncestorPath === folderAncestorPathNext)
                break;
            folderAncestorPath = folderAncestorPathNext;
        }
        return false;
    }
    async watchDirectories(foldersPaths: string[], options: WatcherOptions, handler: WatchHandler, filePath?: string, baseWatcherHandler?: WatcherHandler): Promise<WatcherHandler | undefined> {
        if (this.isClosed())
            return;
        foldersPaths = Utils.lang.uniq(foldersPaths).sort();
        let watcherHandlerLast;
        for (const folderPath of foldersPaths) {
            if (this.isIgnored(folderPath, options.ignore))
                continue;
            if (this.watcherExists(folderPath, options, handler, filePath))
                continue;
            try {
                const watcherOptions = (!options.recursive || (HAS_NATIVE_RECURSION && options.native !== false)) ? options : { ...options, recursive: false }, // Ensuring recursion is explicitly disabled if not available
                    watcher = fs.watch(folderPath, watcherOptions), watcherConfig = { watcher, handler, options, folderPath, filePath }, watcherHandler = watcherHandlerLast = await this.watcherAdd(watcherConfig, baseWatcherHandler);
                const isRoot = this._roots.has(filePath || folderPath);
                if (isRoot) {
                    const parentOptions = { ...options, ignoreInitial: true, recursive: false }, // Ensuring only the parent folder is being watched
                        parentFolderPath = path.dirname(folderPath), parentFilePath = folderPath;
                    await this.watchDirectories([parentFolderPath], parentOptions, handler, parentFilePath, watcherHandler);
                    //TODO: Watch parents recursively with the following code, which requires other things to be changed too though
                    // while ( true ) {
                    //   await this.watchDirectories ( [parentFolderPath], parentOptions, handler, parentFilePath, watcherHandler );
                    //   const parentFolderPathNext = path.dirname ( parentFolderPath );
                    //   if ( parentFolderPath === parentFolderPathNext ) break;
                    //   parentFilePath = parentFolderPath;
                    //   parentFolderPath = parentFolderPathNext;
                    // }
                }
            }
            catch (error) {
                this.error(error);
            }
        }
        return watcherHandlerLast;
    }
    async watchDirectory(folderPath: string, options: WatcherOptions, handler: WatchHandler, filePath?: string, baseWatcherHandler?: WatcherHandler): Promise<void> {
        var _a;
        if (this.isClosed())
            return;
        if (this.isIgnored(folderPath, options.ignore))
            return;
        if (!options.recursive || (HAS_NATIVE_RECURSION && options.native !== false)) {
            return this.watchersLock(() => {
                return this.watchDirectories([folderPath], options, handler, filePath, baseWatcherHandler);
            });
        }
        else {
            options = { ...options, recursive: true }; // Ensuring recursion is explicitly enabled
            const depth = (_a = options.depth) !== null && _a !== void 0 ? _a : DEPTH, [folderSubPaths] = await Utils.fs.readdir(folderPath, options.ignore, depth, this._closeSignal, options.readdirMap);
            return this.watchersLock(async () => {
                const watcherHandler = await this.watchDirectories([folderPath], options, handler, filePath, baseWatcherHandler);
                if (folderSubPaths.length) {
                    const folderPathDepth = stringIndexes(folderPath, path.sep).length;
                    for (const folderSubPath of folderSubPaths) {
                        const folderSubPathDepth = stringIndexes(folderSubPath, path.sep).length, subDepth = Math.max(0, depth - (folderSubPathDepth - folderPathDepth)), subOptions = { ...options, depth: subDepth }; // Updating the maximum depth to account for depth of the sub path
                        await this.watchDirectories([folderSubPath], subOptions, handler, filePath, baseWatcherHandler || watcherHandler);
                    }
                }
            });
        }
    }
    watchFileOnce(filePath: string, options: WatcherOptions, callback: () => unknown) {
        return new Promise<void>(resolve => {
            if (this.isClosed())
                return resolve();
            options = { ...options, ignoreInitial: false }; // Ensuring initial events are detected too
            if (this.subwatcherExists(filePath, options))
                return resolve();
            const config = { targetPath: filePath, options };
            const handler: WatchHandler = (_event, targetPath) => {
                if (targetPath !== filePath)
                    return;
                stop();
                callback();
            };
            const watcher = new Watcher(handler);
            const start = () => {
                this._subwatchers.add(config);
                this.on("close" /* CLOSE */, stop); // Ensuring the subwatcher is stopped on close
                void watcher.watchFile(filePath, options, handler);
            };
            const stop = () => {
                this._subwatchers.delete(config);
                this.removeListener("close" /* CLOSE */, stop); // Ensuring there are no leftover listeners
                watcher.close();
            };
            start();
            resolve();
        });
    }
    async watchFile(filePath: string, options: WatcherOptions, handler: WatchHandler) {
        if (this.isClosed())
            return;
        if (this.isIgnored(filePath, options.ignore))
            return;
        options = { ...options, recursive: false }; // Ensuring recursion is explicitly disabled
        const folderPath = path.dirname(filePath);
        return this.watchDirectory(folderPath, options, handler, filePath);
    }
    async watchPollingOnce(targetPath: string, options: WatcherOptions, callback: () => unknown) {
        if (this.isClosed())
            return;
        let isDone = false;
        const poller = new WatcherPoller();
        const onChange = async () => {
            if (isDone)
                return;
            const events = await poller.update(targetPath, options.pollingTimeout);
            if (!events.length)
                return; // Nothing actually changed, skipping
            if (isDone)
                return; // Another async callback has done the work already, skipping
            isDone = true;
            disposer();
            callback();
        };
        const disposer = await this.watchPolling(targetPath, options, () => {
            void onChange();
        });
    }
    watchPolling(targetPath: string, options: WatcherOptions, callback: fs.StatsListener) {
        return new Promise<() => void | Error>(resolve => {
            if (this.isClosed())
                return resolve(Utils.lang.noop);
            if (this.pollerExists(targetPath, options))
                return resolve(Utils.lang.noop);
            const watcherOptions = { ...options, interval: options.pollingInterval ?? POLLING_INTERVAL }; // Ensuring a default interval is set
            const config = { targetPath, options };
            const start = () => {
                this._pollers.add(config);
                this.on("close" /* CLOSE */, stop); // Ensuring polling is stopped on close
                fs.watchFile(targetPath, watcherOptions, callback);
            };
            const stop = () => {
                this._pollers.delete(config);
                this.removeListener("close" /* CLOSE */, stop); // Ensuring there are no leftover listeners
                fs.unwatchFile(targetPath, callback);
            };
            Utils.lang.attempt(start);
            resolve(() => Utils.lang.attempt(stop));
        });
    }
    async watchUnknownChild(targetPath: string, options: WatcherOptions, handler: WatchHandler): Promise<void> {
        if (this.isClosed())
            return;
        const watch = () => this.watchPath(targetPath, options, handler);
        return this.watchFileOnce(targetPath, options, watch);
    }
    async watchUnknownTarget(targetPath: string, options: WatcherOptions, handler: WatchHandler): Promise<void> {
        if (this.isClosed())
            return;
        const watch = () => this.watchPath(targetPath, options, handler);
        return this.watchPollingOnce(targetPath, options, watch);
    }
    async watchPaths(targetPaths: string[], options: WatcherOptions, handler: WatchHandler) {
        if (this.isClosed())
            return;
        targetPaths = Utils.lang.uniq(targetPaths).sort();
        const isParallelizable = targetPaths.every((targetPath, index) => targetPaths.every((t, i) => i === index || !Utils.fs.isSubPath(targetPath, t))); // All paths are about separate subtrees, so we can start watching in parallel safely //TODO: Find parallelizable chunks rather than using an all or nothing approach
        if (isParallelizable) { // Watching in parallel
            await Promise.all(targetPaths.map(targetPath => {
                return this.watchPath(targetPath, options, handler);
            }));
        }
        else { // Watching serially
            for (const targetPath of targetPaths) {
                await this.watchPath(targetPath, options, handler);
            }
        }
    }
    async watchPath(targetPath: string, options: WatcherOptions, handler: WatchHandler): Promise<void> {
        if (this.isClosed())
            return;
        targetPath = path.normalize(targetPath);
        if (this.isIgnored(targetPath, options.ignore))
            return;
        const stats = await Utils.fs.poll(targetPath, options.pollingTimeout);
        if (!stats) {
            const parentPath = path.dirname(targetPath), parentStats = await Utils.fs.poll(parentPath, options.pollingTimeout);
            if (parentStats === null || parentStats === void 0 ? void 0 : parentStats.isDirectory()) {
                return this.watchUnknownChild(targetPath, options, handler);
            }
            else {
                return this.watchUnknownTarget(targetPath, options, handler);
            }
        }
        else if (stats.isFile()) {
            return this.watchFile(targetPath, options, handler);
        }
        else if (stats.isDirectory()) {
            return this.watchDirectory(targetPath, options, handler);
        }
        else {
            this.error(`"${targetPath}" is not supported`);
        }
    }
    async watch(target?: Target | WatchHandler, options?: WatcherOptions | WatchHandler, handler: WatchHandler = Utils.lang.noop): Promise<void> {
        if (Utils.lang.isFunction(target))
            return this.watch([], {}, target);
        if (Utils.lang.isUndefined(target))
            return this.watch([], options, handler);
        if (Utils.lang.isFunction(options))
            return this.watch(target, {}, options);
        if (Utils.lang.isUndefined(options))
            return this.watch(target, {}, handler);
        if (this.isClosed())
            return;
        if (this.isReady())
            options.readdirMap = undefined; // Only usable before initialization
        const targetPaths = Utils.lang.castArray(target);
        targetPaths.forEach(targetPath => this._roots.add(targetPath));
        await this.watchPaths(targetPaths, options, handler);
        if (this.isClosed())
            return;
        if (handler !== Utils.lang.noop) {
            this.on("all" /* ALL */, handler);
        }
        options.readdirMap = undefined; // Only usable before initialization
        this.ready();
    }
}
/* EXPORT */
const exported = Object.assign(Watcher, { default: Watcher });
Object.defineProperty(exported, "__esModule", { value: true });

export = exported;
