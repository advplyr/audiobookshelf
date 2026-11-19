/* ENUMS */
export type PollEvent = "add" | "addDir" | "change" | "unlink" | "unlinkDir";
export type WatchEvent = PollEvent | "rename" | "renameDir";
export type EntryType = 1 | 2;
