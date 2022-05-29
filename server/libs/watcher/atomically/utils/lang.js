"use strict";
/* LANG */
Object.defineProperty(exports, "__esModule", { value: true });
const Lang = {
    isFunction: (x) => {
        return typeof x === 'function';
    },
    isString: (x) => {
        return typeof x === 'string';
    },
    isUndefined: (x) => {
        return typeof x === 'undefined';
    }
};
/* EXPORT */
exports.default = Lang;
