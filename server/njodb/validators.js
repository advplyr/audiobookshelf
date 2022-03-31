"use strict";

const { existsSync } = require("graceful-fs");

const validateSize = (s) => {
    if (typeof s !== "number") {
        throw new TypeError("Size must be a number");
    } else if (s <= 0) {
        throw new RangeError("Size must be greater than zero");
    }

    return s;
};

const validateName = (n) => {
    if (typeof n !== "string") {
        throw new TypeError("Name must be a string");
    } else if (n.trim().length <= 0) {
        throw new Error("Name must be a non-blank string")
    }

    return n;
};

const validatePath = (p) => {
    if (typeof p !== "string") {
        throw new TypeError("Path must be a string");
    } else if (p.trim().length <= 0) {
        throw new Error("Path must be a non-blank string");
    } else if (!existsSync(p)) {
        throw new Error("Path does not exist");
    }

    return p;
};

const validateArray = (a) => {
    if (!Array.isArray(a)) {
        throw new TypeError("Not an array");
    }

    return a;
};

const validateObject = (o) => {
    if (typeof o !== "object") {
        throw new TypeError("Not an object");
    }

    return o;
};

const validateFunction = (f) => {
    if (typeof f !== "function") {
        throw new TypeError("Not a function")
    } else {
        const fString = f.toString();
        if (/\s*function/.test(fString) && !/\W+return\W+/.test(fString)) throw new Error("Function must return a value");
    }

    return f;
}

exports.validateSize = validateSize;
exports.validateName = validateName;
exports.validatePath = validatePath;
exports.validateArray = validateArray;
exports.validateObject = validateObject;
exports.validateFunction = validateFunction;