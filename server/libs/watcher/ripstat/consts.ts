/* IMPORT */
import { constants } from "node:fs";

/* CONSTS */
export const IS_WINDOWS = (process.platform === 'win32');
export const { MAX_SAFE_INTEGER } = Number;
export const RETRY_TIMEOUT = 5000;
export const { S_IFBLK, S_IFCHR, S_IFDIR, S_IFIFO, S_IFLNK, S_IFMT, S_IFREG, S_IFSOCK } = constants;
