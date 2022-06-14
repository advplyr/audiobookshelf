"use strict";
/* IMPORT */
Object.defineProperty(exports, "__esModule", { value: true });
exports.retryifySync = exports.retryifyAsync = void 0;
const retryify_queue_1 = require("./retryify_queue");
/* RETRYIFY */
const retryifyAsync = (fn, isRetriableError) => {
    return function (timestamp) {
        return function attempt() {
            return retryify_queue_1.default.schedule().then(cleanup => {
                return fn.apply(undefined, arguments).then(result => {
                    cleanup();
                    return result;
                }, error => {
                    cleanup();
                    if (Date.now() >= timestamp)
                        throw error;
                    if (isRetriableError(error)) {
                        const delay = Math.round(100 + (400 * Math.random())), delayPromise = new Promise(resolve => setTimeout(resolve, delay));
                        return delayPromise.then(() => attempt.apply(undefined, arguments));
                    }
                    throw error;
                });
            });
        };
    };
};
exports.retryifyAsync = retryifyAsync;
const retryifySync = (fn, isRetriableError) => {
    return function (timestamp) {
        return function attempt() {
            try {
                return fn.apply(undefined, arguments);
            }
            catch (error) {
                if (Date.now() > timestamp)
                    throw error;
                if (isRetriableError(error))
                    return attempt.apply(undefined, arguments);
                throw error;
            }
        };
    };
};
exports.retryifySync = retryifySync;
