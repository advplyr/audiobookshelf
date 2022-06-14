"use strict";
/* IMPORT */
Object.defineProperty(exports, "__esModule", { value: true });
exports.attemptifySync = exports.attemptifyAsync = void 0;
const consts_1 = require("../consts");
/* ATTEMPTIFY */
//TODO: Maybe publish this as a standalone package
//FIXME: The type castings here aren't exactly correct
const attemptifyAsync = (fn, onError = consts_1.NOOP) => {
    return function () {
        return fn.apply(undefined, arguments).catch(onError);
    };
};
exports.attemptifyAsync = attemptifyAsync;
const attemptifySync = (fn, onError = consts_1.NOOP) => {
    return function () {
        try {
            return fn.apply(undefined, arguments);
        }
        catch (error) {
            return onError(error);
        }
    };
};
exports.attemptifySync = attemptifySync;
