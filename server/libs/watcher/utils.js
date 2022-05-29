"use strict";
/* IMPORT */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const are_shallow_equal_1 = __importDefault(require("./are-shallow-equal"));
const debounce_1 = __importDefault(require("./debounce"));
const path_1 = __importDefault(require("path"));
const ripstat_1 = __importDefault(require("./ripstat"));
const tiny_readdir_1 = __importDefault(require("./tiny-readdir"));
const constants_1 = require("./constants");
/* UTILS */
const Utils = {
    lang: {
        areShallowEqual: //TODO: Import all these utilities from "nanodash" instead
            are_shallow_equal_1.default,
        debounce: debounce_1.default,
        attempt: (fn) => {
            try {
                return fn();
            }
            catch (error) {
                return Utils.lang.castError(error);
            }
        },
        castArray: (x) => {
            return Utils.lang.isArray(x) ? x : [x];
        },
        castError(exception) {
            if (Utils.lang.isError(exception))
                return exception;
            if (Utils.lang.isString(exception))
                return new Error(exception);
            return new Error('Unknown error');
        },
        defer: (callback) => {
            return setTimeout(callback, 0);
        },
        isArray: (x) => {
            return Array.isArray(x);
        },
        isError(x) {
            return x instanceof Error;
        },
        isFunction: (x) => {
            return typeof x === 'function';
        },
        isNumber: (x) => {
            return typeof x === 'number';
        },
        isString: (x) => {
            return typeof x === 'string';
        },
        isUndefined: (x) => {
            return x === undefined;
        },
        noop: () => {
            return;
        },
        uniq: (arr) => {
            if (arr.length < 2)
                return arr;
            return Array.from(new Set(arr));
        }
    },
    fs: {
        isSubPath: (targetPath, subPath) => {
            return (subPath.startsWith(targetPath) && subPath[targetPath.length] === path_1.default.sep && (subPath.length - targetPath.length) > path_1.default.sep.length);
        },
        poll: (targetPath, timeout = constants_1.POLLING_TIMEOUT) => {
            return ripstat_1.default(targetPath, timeout).catch(Utils.lang.noop);
        },
        readdir: async (rootPath, ignore, depth = Infinity, signal, readdirMap) => {
            if (readdirMap && depth === 1 && rootPath in readdirMap) { // Reusing cached data
                const result = readdirMap[rootPath];
                return [result.directories, result.files];
            }
            else { // Retrieving fresh data
                const result = await tiny_readdir_1.default(rootPath, { depth, ignore, signal });
                return [result.directories, result.files];
            }
        }
    }
};
/* EXPORT */
exports.default = Utils;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvdXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUNBLFlBQVk7Ozs7O0FBRVosMEVBQWdEO0FBQ2hELHdEQUFnQztBQUNoQyxnREFBd0I7QUFDeEIsc0RBQThCO0FBQzlCLGdFQUFtQztBQUNuQywyQ0FBNEM7QUFHNUMsV0FBVztBQUVYLE1BQU0sS0FBSyxHQUFHO0lBRVosSUFBSSxFQUFFO1FBRUosZUFBZSxFQUZULDBEQUEwRDtRQUVoRSwyQkFBZTtRQUVmLFFBQVEsRUFBUixrQkFBUTtRQUVSLE9BQU8sRUFBRSxDQUFNLEVBQVcsRUFBYyxFQUFFO1lBRXhDLElBQUk7Z0JBRUYsT0FBTyxFQUFFLEVBQUcsQ0FBQzthQUVkO1lBQUMsT0FBUSxLQUFjLEVBQUc7Z0JBRXpCLE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUcsS0FBSyxDQUFFLENBQUM7YUFFdkM7UUFFSCxDQUFDO1FBRUQsU0FBUyxFQUFFLENBQU0sQ0FBVSxFQUFRLEVBQUU7WUFFbkMsT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBRyxDQUFDLENBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRTVDLENBQUM7UUFFRCxTQUFTLENBQUcsU0FBa0I7WUFFNUIsSUFBSyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBRyxTQUFTLENBQUU7Z0JBQUcsT0FBTyxTQUFTLENBQUM7WUFFekQsSUFBSyxLQUFLLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBRyxTQUFTLENBQUU7Z0JBQUcsT0FBTyxJQUFJLEtBQUssQ0FBRyxTQUFTLENBQUUsQ0FBQztZQUV4RSxPQUFPLElBQUksS0FBSyxDQUFHLGVBQWUsQ0FBRSxDQUFDO1FBRXZDLENBQUM7UUFFRCxLQUFLLEVBQUUsQ0FBRSxRQUFrQixFQUFtQixFQUFFO1lBRTlDLE9BQU8s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