/* IMPORT */
export { Stats } from "./ripstat";
import WatcherStatsRuntime from "./watcher_stats";
import type { FSWatcher, WatchOptions } from "node:fs";
import type { WatchEvent } from "./enums";
import type Utils from "./utils";

export type WatchHandler = (event: WatchEvent, targetPath: string, nextPath?: string) => void;
export type IgnorePath = (targetPath: string) => unknown;
export type ReaddirMap = NonNullable<Parameters<typeof Utils.fs.readdir>[4]>;

export interface WatcherOptions extends Omit<WatchOptions, "encoding"> {
    debounce?: number;
    depth?: number;
    encoding?: BufferEncoding;
    ignore?: IgnorePath;
    ignored?: RegExp;
    ignoreInitial?: boolean;
    native?: boolean;
    pollingInterval?: number;
    pollingTimeout?: number;
    readdirMap?: ReaddirMap;
    renameDetection?: boolean;
    renameTimeout?: number;
}

export interface WatcherConfig {
    watcher: FSWatcher;
    handler: WatchHandler;
    options: WatcherOptions;
    folderPath: string;
    filePath?: string;
}

export const WatcherStats = WatcherStatsRuntime;
