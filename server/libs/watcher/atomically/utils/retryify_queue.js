"use strict";
/* IMPORT */
Object.defineProperty(exports, "__esModule", { value: true });
const consts_1 = require("../consts");
/* RETRYIFY QUEUE */
const RetryfyQueue = {
    interval: 25,
    intervalId: undefined,
    limit: consts_1.LIMIT_FILES_DESCRIPTORS,
    queueActive: new Set(),
    queueWaiting: new Set(),
    init: () => {
        if (RetryfyQueue.intervalId)
            return;
        RetryfyQueue.intervalId = setInterval(RetryfyQueue.tick, RetryfyQueue.interval);
    },
    reset: () => {
        if (!RetryfyQueue.intervalId)
            return;
        clearInterval(RetryfyQueue.intervalId);
        delete RetryfyQueue.intervalId;
    },
    add: (fn) => {
        RetryfyQueue.queueWaiting.add(fn);
        if (RetryfyQueue.queueActive.size < (RetryfyQueue.limit / 2)) { // Active queue not under preassure, executing immediately
            RetryfyQueue.tick();
        }
        else {
            RetryfyQueue.init();
        }
    },
    remove: (fn) => {
        RetryfyQueue.queueWaiting.delete(fn);
        RetryfyQueue.queueActive.delete(fn);
    },
    schedule: () => {
        return new Promise(resolve => {
            const cleanup = () => RetryfyQueue.remove(resolver);
            const resolver = () => resolve(cleanup);
            RetryfyQueue.add(resolver);
        });
    },
    tick: () => {
        if (RetryfyQueue.queueActive.size >= RetryfyQueue.limit)
            return;
        if (!RetryfyQueue.queueWaiting.size)
            return RetryfyQueue.reset();
        for (const fn of RetryfyQueue.queueWaiting) {
            if (RetryfyQueue.queueActive.size >= RetryfyQueue.limit)
                break;
            RetryfyQueue.queueWaiting.delete(fn);
            RetryfyQueue.queueActive.add(fn);
            fn();
        }
    }
};
/* EXPORT */
exports.default = RetryfyQueue;
