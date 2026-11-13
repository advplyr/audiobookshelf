/* CONSTS */
export const DEFAULT_ENCODING = 'utf8';
export const DEFAULT_FILE_MODE = 0o666;
export const DEFAULT_FOLDER_MODE = 0o777;
export const DEFAULT_READ_OPTIONS = {};
export const DEFAULT_WRITE_OPTIONS = {};
export const DEFAULT_TIMEOUT_ASYNC = 5000;
export const DEFAULT_TIMEOUT_SYNC = 100;
export const IS_POSIX = !!process.getuid;
export const IS_USER_ROOT = process.getuid ? !process.getuid() : false;
export const LIMIT_BASENAME_LENGTH = 128; //TODO: fetch the real limit from the filesystem //TODO: fetch the whole-path length limit too
export const LIMIT_FILES_DESCRIPTORS = 10000; //TODO: fetch the real limit from the filesystem
export const NOOP = () => { };
