/* IMPORT */
import path from "node:path";
import type { FSWatcher, WatchEventType } from "node:fs";
import { DEBOUNCE, DEPTH, HAS_NATIVE_RECURSION, IS_WINDOWS } from "./constants";
import Utils from "./utils";
import type { PollEvent, WatchEvent } from "./enums";
import type { IgnorePath, WatcherOptions, WatcherConfig, WatchHandler } from "./types";
import type WatcherLocker from "./watcher_locker";
import type WatcherPoller from "./watcher_poller";

type TargetEvent = [event: PollEvent, targetPath: string];
type BatchedHandler = (event: WatchEventType, targetPath?: string, isInitial?: boolean) => Promise<void>;

interface Watcher {
    _readyWait: Promise<void>;
    _closeSignal: { aborted: boolean };
    _poller: WatcherPoller;
    _locker: WatcherLocker;
    isClosed(): boolean;
    isReady(): boolean;
    isIgnored(targetPath: string, ignore?: IgnorePath): boolean;
    event(event: WatchEvent, targetPath: string): unknown;
    error(exception: unknown): unknown;
    watchDirectory(folderPath: string, options: WatcherOptions, handler: WatchHandler, filePath?: string, base?: WatcherHandler): Promise<unknown>;
    watchersClose(folderPath: string, filePath?: string, recursive?: boolean): void;
}

/* WATCHER HANDLER */
class WatcherHandler {
    declare base: WatcherHandler | undefined;
    declare watcher: Watcher;
    declare handler: WatchHandler;
    declare fswatcher: FSWatcher;
    declare options: WatcherOptions;
    declare folderPath: string;
    declare filePath: string | undefined;
    declare handlerBatched: BatchedHandler;

    /* CONSTRUCTOR */
    constructor(watcher: Watcher, config: WatcherConfig, base?: WatcherHandler) {
        this.base = base;
        this.watcher = watcher;
        this.handler = config.handler;
        this.fswatcher = config.watcher;
        this.options = config.options;
        this.folderPath = config.folderPath;
        this.filePath = config.filePath;
        this['handlerBatched'] = this.base ? this.base.onWatcherEvent.bind(this.base) : this._makeHandlerBatched(this.options.debounce); //UGLY
    }
    /* HELPERS */
    _isSubRoot(targetPath: string) {
        if (this.filePath) {
            return targetPath === this.filePath;
        }
        else {
            return targetPath === this.folderPath || Utils.fs.isSubPath(this.folderPath, targetPath);
        }
    }
    _makeHandlerBatched(delay = DEBOUNCE) {
        return (() => {
            let lock = this.watcher._readyWait, // ~Ensuring no two flushes are active in parallel, or before the watcher is ready
            initials: TargetEvent[] = [], regulars = new Set<string>();
            const flush = async (initials: TargetEvent[], regulars: Set<string>) => {
                const initialEvents = this.options.ignoreInitial ? [] : initials, regularEvents = await this.eventsPopulate([...regulars]), events = this.eventsDeduplicate([...initialEvents, ...regularEvents]);
                this.onTargetEvents(events);
            };
            const flushDebounced = Utils.lang.debounce(() => {
                if (this.watcher.isClosed())
                    return;
                lock = flush(initials, regulars);
                initials = [];
                regulars = new Set();
            }, delay);
            return async (_event: WatchEventType, targetPath = '', isInitial = false) => {
                if (isInitial) { // Poll immediately
                    await this.eventsPopulate([targetPath], initials, true);
                }
                else { // Poll later
                    regulars.add(targetPath);
                }
                void lock.then(flushDebounced);
            };
        })();
    }
    /* EVENT HELPERS */
    eventsDeduplicate(events: TargetEvent[]) {
        if (events.length < 2)
            return events;
        const targetsEventPrev: Partial<Record<string, PollEvent>> = {};
        return events.reduce<TargetEvent[]>((acc, event) => {
            const [targetEvent, targetPath] = event, targetEventPrev = targetsEventPrev[targetPath];
            if (targetEvent === targetEventPrev)
                return acc; // Same event, ignoring
            if (targetEvent === "change" /* CHANGE */ && targetEventPrev === "add" /* ADD */)
                return acc; // "change" after "add", ignoring
            targetsEventPrev[targetPath] = targetEvent;
            acc.push(event);
            return acc;
        }, []);
    }
    async eventsPopulate(targetPaths: string[], events: TargetEvent[] = [], isInitial = false) {
        await Promise.all(targetPaths.map(async (targetPath) => {
            const targetEvents = await this.watcher._poller.update(targetPath, this.options.pollingTimeout);
            await Promise.all(targetEvents.map(async (event) => {
                events.push([event, targetPath]);
                if (event === "addDir" /* ADD_DIR */) {
                    await this.eventsPopulateAddDir(targetPaths, targetPath, events, isInitial);
                }
                else if (event === "unlinkDir" /* UNLINK_DIR */) {
                    await this.eventsPopulateUnlinkDir(targetPaths, targetPath, events, isInitial);
                }
            }));
        }));
        return events;
    }
    async eventsPopulateAddDir(targetPaths: string[], targetPath: string, events: TargetEvent[] = [], isInitial = false) {
        if (isInitial)
            return events;
        const depth = this.options.recursive ? this.options.depth ?? DEPTH : Math.min(1, this.options.depth ?? DEPTH), [directories, files] = await Utils.fs.readdir(targetPath, this.options.ignore, depth, this.watcher._closeSignal), targetSubPaths = [...directories, ...files];
        await Promise.all(targetSubPaths.map(targetSubPath => {
            if (this.watcher.isIgnored(targetSubPath, this.options.ignore))
                return Promise.resolve();
            if (targetPaths.includes(targetSubPath))
                return Promise.resolve();
            return this.eventsPopulate([targetSubPath], events, true);
        }));
        return events;
    }
    async eventsPopulateUnlinkDir(targetPaths: string[], targetPath: string, events: TargetEvent[] = [], isInitial = false) {
        if (isInitial)
            return events;
        for (const folderPathOther of this.watcher._poller.stats.keys()) {
            if (!Utils.fs.isSubPath(targetPath, folderPathOther))
                continue;
            if (targetPaths.includes(folderPathOther))
                continue;
            await this.eventsPopulate([folderPathOther], events, true);
        }
        return events;
    }
    /* EVENT HANDLERS */
    onTargetAdd(targetPath: string) {
        if (this._isSubRoot(targetPath)) {
            if (this.options.renameDetection) {
                this.watcher._locker.getLockTargetAdd(targetPath, this.options.renameTimeout);
            }
            else {
                this.watcher.event("add" /* ADD */, targetPath);
            }
        }
    }
    onTargetAddDir(targetPath: string) {
        if (targetPath !== this.folderPath && this.options.recursive && (!HAS_NATIVE_RECURSION && this.options.native !== false)) {
            void this.watcher.watchDirectory(targetPath, this.options, this.handler, undefined, this.base || this);
        }
        if (this._isSubRoot(targetPath)) {
            if (this.options.renameDetection) {
                this.watcher._locker.getLockTargetAddDir(targetPath, this.options.renameTimeout);
            }
            else {
                this.watcher.event("addDir" /* ADD_DIR */, targetPath);
            }
        }
    }
    onTargetChange(targetPath: string) {
        if (this._isSubRoot(targetPath)) {
            this.watcher.event("change" /* CHANGE */, targetPath);
        }
    }
    onTargetUnlink(targetPath: string) {
        this.watcher.watchersClose(path.dirname(targetPath), targetPath, false);
        if (this._isSubRoot(targetPath)) {
            if (this.options.renameDetection) {
                this.watcher._locker.getLockTargetUnlink(targetPath, this.options.renameTimeout);
            }
            else {
                this.watcher.event("unlink" /* UNLINK */, targetPath);
            }
        }
    }
    onTargetUnlinkDir(targetPath: string) {
        this.watcher.watchersClose(path.dirname(targetPath), targetPath, false);
        this.watcher.watchersClose(targetPath);
        if (this._isSubRoot(targetPath)) {
            if (this.options.renameDetection) {
                this.watcher._locker.getLockTargetUnlinkDir(targetPath, this.options.renameTimeout);
            }
            else {
                this.watcher.event("unlinkDir" /* UNLINK_DIR */, targetPath);
            }
        }
    }
    onTargetEvent(event: TargetEvent) {
        const [targetEvent, targetPath] = event;
        if (targetEvent === "add" /* ADD */) {
            this.onTargetAdd(targetPath);
        }
        else if (targetEvent === "addDir" /* ADD_DIR */) {
            this.onTargetAddDir(targetPath);
        }
        else if (targetEvent === "change" /* CHANGE */) {
            this.onTargetChange(targetPath);
        }
        else if (targetEvent === "unlink" /* UNLINK */) {
            this.onTargetUnlink(targetPath);
        }
        else if (targetEvent === "unlinkDir" /* UNLINK_DIR */) {
            this.onTargetUnlinkDir(targetPath);
        }
    }
    onTargetEvents(events: TargetEvent[]) {
        for (const event of events) {
            this.onTargetEvent(event);
        }
    }
    onWatcherEvent(event: WatchEventType, targetPath?: string, isInitial = false) {
        return this['handlerBatched'](event, targetPath, isInitial);
    }
    onWatcherChange(event: WatchEventType = "change", targetName?: string | null) {
        if (this.watcher.isClosed())
            return;
        const targetPath = path.resolve(this.folderPath, targetName || '');
        if (this.filePath && targetPath !== this.folderPath && targetPath !== this.filePath)
            return;
        if (this.watcher.isIgnored(targetPath, this.options.ignore))
            return;
        void this.onWatcherEvent(event, targetPath);
    }
    onWatcherError(error: NodeJS.ErrnoException) {
        if (IS_WINDOWS && error.code === 'EPERM') { // This may happen when a folder is deleted
            this.onWatcherChange("change" /* CHANGE */, '');
        }
        else {
            this.watcher.error(error);
        }
    }
    /* API */
    async init() {
        await this.initWatcherEvents();
        await this.initInitialEvents();
    }
    initWatcherEvents() {
        return new Promise<void>(resolve => {
            const onChange = this.onWatcherChange.bind(this);
            this.fswatcher.on("change" /* CHANGE */, onChange);
            const onError = this.onWatcherError.bind(this);
            this.fswatcher.on("error" /* ERROR */, onError);
            resolve();
        });
    }
    async initInitialEvents() {
        const isInitial = !this.watcher.isReady(); // "isInitial" => is ignorable via the "ignoreInitial" option
        if (this.filePath) { // Single initial path
            if (this.watcher._poller.stats.has(this.filePath))
                return; // Already polled
            await this.onWatcherEvent("change" /* CHANGE */, this.filePath, isInitial);
        }
        else { // Multiple initial paths
            const depth = this.options.recursive && (HAS_NATIVE_RECURSION && this.options.native !== false) ? this.options.depth ?? DEPTH : Math.min(1, this.options.depth ?? DEPTH), [directories, files] = await Utils.fs.readdir(this.folderPath, this.options.ignore, depth, this.watcher._closeSignal, this.options.readdirMap), targetPaths = [this.folderPath, ...directories, ...files];
            await Promise.all(targetPaths.map(targetPath => {
                if (this.watcher._poller.stats.has(targetPath))
                    return Promise.resolve(); // Already polled
                if (this.watcher.isIgnored(targetPath, this.options.ignore))
                    return Promise.resolve();
                return this.onWatcherEvent("change" /* CHANGE */, targetPath, isInitial);
            }));
        }
    }
}
/* EXPORT */
export default WatcherHandler;
