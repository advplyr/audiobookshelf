"use strict";
/* IMPORT */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const constants_1 = require("./constants");
const utils_1 = __importDefault(require("./utils"));
/* WATCHER HANDLER */
class WatcherHandler {
    /* CONSTRUCTOR */
    constructor(watcher, config, base) {
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
    _isSubRoot(targetPath) {
        if (this.filePath) {
            return targetPath === this.filePath;
        }
        else {
            return targetPath === this.folderPath || utils_1.default.fs.isSubPath(this.folderPath, targetPath);
        }
    }
    _makeHandlerBatched(delay = constants_1.DEBOUNCE) {
        return (() => {
            let lock = this.watcher._readyWait, // ~Ensuring no two flushes are active in parallel, or before the watcher is ready
            initials = [], regulars = new Set();
            const flush = async (initials, regulars) => {
                const initialEvents = this.options.ignoreInitial ? [] : initials, regularEvents = await this.eventsPopulate([...regulars]), events = this.eventsDeduplicate([...initialEvents, ...regularEvents]);
                this.onTargetEvents(events);
            };
            const flushDebounced = utils_1.default.lang.debounce(() => {
                if (this.watcher.isClosed())
                    return;
                lock = flush(initials, regulars);
                initials = [];
                regulars = new Set();
            }, delay);
            return async (event, targetPath = '', isInitial = false) => {
                if (isInitial) { // Poll immediately
                    await this.eventsPopulate([targetPath], initials, true);
                }
                else { // Poll later
                    regulars.add(targetPath);
                }
                lock.then(flushDebounced);
            };
        })();
    }
    /* EVENT HELPERS */
    eventsDeduplicate(events) {
        if (events.length < 2)
            return events;
        const targetsEventPrev = {};
        return events.reduce((acc, event) => {
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
    async eventsPopulate(targetPaths, events = [], isInitial = false) {
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
    ;
    async eventsPopulateAddDir(targetPaths, targetPath, events = [], isInitial = false) {
        var _a, _b;
        if (isInitial)
            return events;
        const depth = this.options.recursive ? (_a = this.options.depth) !== null && _a !== void 0 ? _a : constants_1.DEPTH : Math.min(1, (_b = this.options.depth) !== null && _b !== void 0 ? _b : constants_1.DEPTH), [directories, files] = await utils_1.default.fs.readdir(targetPath, this.options.ignore, depth, this.watcher._closeSignal), targetSubPaths = [...directories, ...files];
        await Promise.all(targetSubPaths.map(targetSubPath => {
            if (this.watcher.isIgnored(targetSubPath, this.options.ignore))
                return;
            if (targetPaths.includes(targetSubPath))
                return;
            return this.eventsPopulate([targetSubPath], events, true);
        }));
        return events;
    }
    async eventsPopulateUnlinkDir(targetPaths, targetPath, events = [], isInitial = false) {
        if (isInitial)
            return events;
        for (const folderPathOther of this.watcher._poller.stats.keys()) {
            if (!utils_1.default.fs.isSubPath(targetPath, folderPathOther))
                continue;
            if (targetPaths.includes(folderPathOther))
                continue;
            await this.eventsPopulate([folderPathOther], events, true);
        }
        return events;
    }
    /* EVENT HANDLERS */
    onTargetAdd(targetPath) {
        if (this._isSubRoot(targetPath)) {
            if (this.options.renameDetection) {
                this.watcher._locker.getLockTargetAdd(targetPath, this.options.renameTimeout);
            }
            else {
                this.watcher.event("add" /* ADD */, targetPath);
            }
        }
    }
    onTargetAddDir(targetPath) {
        if (targetPath !== this.folderPath && this.options.recursive && (!constants_1.HAS_NATIVE_RECURSION && this.options.native !== false)) {
            this.watcher.watchDirectory(targetPath, this.options, this.handler, undefined, this.base || this);
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
    onTargetChange(targetPath) {
        if (this._isSubRoot(targetPath)) {
            this.watcher.event("change" /* CHANGE */, targetPath);
        }
    }
    onTargetUnlink(targetPath) {
        this.watcher.watchersClose(path_1.default.dirname(targetPath), targetPath, false);
        if (this._isSubRoot(targetPath)) {
            if (this.options.renameDetection) {
                this.watcher._locker.getLockTargetUnlink(targetPath, this.options.renameTimeout);
            }
            else {
                this.watcher.event("unlink" /* UNLINK */, targetPath);
            }
        }
    }
    onTargetUnlinkDir(targetPath) {
        this.watcher.watchersClose(path_1.default.dirname(targetPath), targetPath, false);
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
    onTargetEvent(event) {
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
    onTargetEvents(events) {
        for (const event of events) {
            this.onTargetEvent(event);
        }
    }
    onWatcherEvent(event, targetPath, isInitial = false) {
        return this['handlerBatched'](event, targetPath, isInitial);
    }
    onWatcherChange(event = "change" /* CHANGE */, targetName) {
        if (this.watcher.isClosed())
            return;
        const targetPath = path_1.default.resolve(this.folderPath, targetName || '');
        if (this.filePath && targetPath !== this.folderPath && targetPath !== this.filePath)
            return;
        if (this.watcher.isIgnored(targetPath, this.options.ignore))
            return;
        this.onWatcherEvent(event, targetPath);
    }
    onWatcherError(error) {
        if (constants_1.IS_WINDOWS && error.code === 'EPERM') { // This may happen when a folder is deleted
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
    async initWatcherEvents() {
        const onChange = this.onWatcherChange.bind(this);
        this.fswatcher.on("change" /* CHANGE */, onChange);
        const onError = this.onWatcherError.bind(this);
        this.fswatcher.on("error" /* ERROR */, onError);
    }
    async initInitialEvents() {
        var _a, _b;
        const isInitial = !this.watcher.isReady(); // "isInitial" => is ignorable via the "ignoreInitial" option
        if (this.filePath) { // Single initial path
            if (this.watcher._poller.stats.has(this.filePath))
                return; // Already polled
            await this.onWatcherEvent("change" /* CHANGE */, this.filePath, isInitial);
        }
        else { // Multiple initial paths
            const depth = this.options.recursive && (constants_1.HAS_NATIVE_RECURSION && this.options.native !== false) ? (_a = this.options.depth) !== null && _a !== void 0 ? _a : constants_1.DEPTH : Math.min(1, (_b = this.options.depth) !== null && _b !== void 0 ? _b : constants_1.DEPTH), [directories, files] = await utils_1.default.fs.readdir(this.folderPath, this.options.ignore, depth, this.watcher._closeSignal, this.options.readdirMap), targetPaths = [this.folderPath, ...directories, ...files];
            await Promise.all(targetPaths.map(targetPath => {
                if (this.watcher._poller.stats.has(targetPath))
                    return; // Already polled
                if (this.watcher.isIgnored(targetPath, this.options.ignore))
                    return;
                return this.onWatcherEvent("change" /* CHANGE */, targetPath, isInitial);
            }));
        }
    }
}
/* EXPORT */
exports.default = WatcherHandler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2F0Y2hlcl9oYW5kbGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL3dhdGNoZXJfaGFuZGxlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQ0EsWUFBWTs7Ozs7QUFFWixnREFBd0I7QUFDeEIsMkNBQThFO0FBRTlFLG9EQUE0QjtBQUk1QixxQkFBcUI7QUFFckIsTUFBTSxjQUFjO0lBWWxCLGlCQUFpQjtJQUVqQixZQUFjLE9BQWdCLEVBQUUsTUFBcUIsRUFBRSxJQUFxQjtRQUUxRSxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztRQUNqQixJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztRQUN2QixJQUFJLENBQUMsT0FBTyxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUM7UUFDOUIsSUFBSSxDQUFDLFNBQVMsR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDO1FBQ2hDLElBQUksQ0FBQyxPQUFPLEdBQUcsTUFBTSxDQUFDLE9BQU8sQ0FBQztRQUM5QixJQUFJLENBQUMsVUFBVSxHQUFHLE1BQU0sQ0FBQyxVQUFVLENBQUM7UUFDcEMsSUFBSSxDQUFDLFFBQVEsR0FBRyxNQUFNLENBQUMsUUFBUSxDQUFDO1FBRWhDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBRyxJQUFJLENBQUMsSUFBSSxDQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBRSxDQUFDLENBQUMsTUFBTTtJQUUvSSxDQUFDO0lBRUQsYUFBYTtJQUViLFVBQVUsQ0FBRyxVQUFnQjtRQUUzQixJQUFLLElBQUksQ0FBQyxRQUFRLEVBQUc7WUFFbkIsT0FBTyxVQUFVLEtBQUssSUFBSSxDQUFDLFFBQVEsQ0FBQztTQUVyQzthQUFNO1lBRUwsT0FBTyxVQUFV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