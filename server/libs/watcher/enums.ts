/* ENUMS */
export type PollEvent = "add" | "addDir" | "change" | "unlink" | "unlinkDir";
export type RenameEvent = "rename" | "renameDir";
export type WatchEvent = PollEvent | RenameEvent;
export type EntryType = 1 | 2;
