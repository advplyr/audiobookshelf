/* IMPORT */
import areShallowEqual from "./are-shallow-equal";
import debounce from "./debounce";
import path from "node:path";
import ripstat from "./ripstat";
import tinyReaddir from "./tiny-readdir";
import { POLLING_TIMEOUT } from "./constants";

type ReaddirMap = Awaited<ReturnType<typeof tinyReaddir>>["map"];
type ReaddirOptions = NonNullable<Parameters<typeof tinyReaddir>[1]>;

/* UTILS */
const Utils = {
    lang: {
        areShallowEqual: //TODO: Import all these utilities from "nanodash" instead
            areShallowEqual,
        debounce: debounce,
        attempt: <Value>(fn: () => Value): Value | Error => {
            try {
                return fn();
            }
            catch (error) {
                return Utils.lang.castError(error);
            }
        },
        castArray: <Value>(x: Value | Value[]): Value[] => {
            return Utils.lang.isArray(x) ? x : [x];
        },
        castError(exception: unknown): Error {
            if (Utils.lang.isError(exception))
                return exception;
            if (Utils.lang.isString(exception))
                return new Error(exception);
            return new Error('Unknown error');
        },
        defer: (callback: () => void) => {
            return setTimeout(callback, 0);
        },
        isArray: (x: unknown) => {
            return Array.isArray(x);
        },
        isError(x: unknown): x is Error {
            return x instanceof Error;
        },
        isFunction: (x: unknown) => {
            return typeof x === 'function';
        },
        isNumber: (x: unknown) => {
            return typeof x === 'number';
        },
        isString: (x: unknown) => {
            return typeof x === 'string';
        },
        isUndefined: (x: unknown) => {
            return x === undefined;
        },
        noop: () => {
            return;
        },
        uniq: <Value>(arr: Value[]): Value[] => {
            if (arr.length < 2)
                return arr;
            return Array.from(new Set(arr));
        }
    },
    fs: {
        isSubPath: (targetPath: string, subPath: string) => {
            return (subPath.startsWith(targetPath) && subPath[targetPath.length] === path.sep && (subPath.length - targetPath.length) > path.sep.length);
        },
        poll: (targetPath: string, timeout = POLLING_TIMEOUT) => {
            return ripstat(targetPath, timeout).catch(Utils.lang.noop);
        },
        readdir: async (rootPath: string, ignore: ReaddirOptions["ignore"], depth = Infinity, signal?: ReaddirOptions["signal"], readdirMap?: ReaddirMap): Promise<[string[], string[]]> => {
            if (readdirMap && depth === 1 && rootPath in readdirMap) { // Reusing cached data
                const result = readdirMap[rootPath];
                return [result.directories, result.files];
            }
            else { // Retrieving fresh data
                const result = await tinyReaddir(rootPath, { depth, ignore, signal });
                return [result.directories, result.files];
            }
        }
    }
};
/* EXPORT */
export default Utils;
