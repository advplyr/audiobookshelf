/* IMPORT */
import { LIMIT_FILES_DESCRIPTORS } from "../consts";

type QueueTask = () => void;

/* RETRYIFY QUEUE */
const RetryfyQueue = {
    interval: 25,
    intervalId: undefined as NodeJS.Timeout | undefined,
    limit: LIMIT_FILES_DESCRIPTORS,
    queueActive: new Set<QueueTask>(),
    queueWaiting: new Set<QueueTask>(),
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
    add: (fn: QueueTask) => {
        RetryfyQueue.queueWaiting.add(fn);
        if (RetryfyQueue.queueActive.size < (RetryfyQueue.limit / 2)) { // Active queue not under pressure, executing immediately
            RetryfyQueue.tick();
        }
        else {
            RetryfyQueue.init();
        }
    },
    remove: (fn: QueueTask) => {
        RetryfyQueue.queueWaiting.delete(fn);
        RetryfyQueue.queueActive.delete(fn);
    },
    schedule: () => {
        return new Promise<QueueTask>(resolve => {
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
export default RetryfyQueue;
