/* IMPORT */
import RetryfyQueue from "./retryify_queue";

/* RETRYIFY */
export const retryifyAsync = <Args extends unknown[], Result>(fn: (...args: Args) => Promise<Result>, isRetriableError: (error: unknown) => boolean) => {
    return function (timestamp: number) {
        return function attempt(...args: Args): Promise<Result> {
            return RetryfyQueue.schedule().then(cleanup => {
                return fn.apply(undefined, args).then(result => {
                    cleanup();
                    return result;
                }, (error: unknown) => {
                    cleanup();
                    if (Date.now() >= timestamp)
                        throw error;
                    if (isRetriableError(error)) {
                        const delay = Math.round(100 + (400 * Math.random())), delayPromise = new Promise<void>(resolve => setTimeout(resolve, delay));
                        return delayPromise.then(() => attempt.apply(undefined, args));
                    }
                    throw error;
                });
            });
        };
    };
};
export const retryifySync = <Args extends unknown[], Result>(fn: (...args: Args) => Result, isRetriableError: (error: unknown) => boolean) => {
    return function (timestamp: number) {
        return function attempt(...args: Args): Result {
            try {
                return fn.apply(undefined, args);
            }
            catch (error) {
                if (Date.now() > timestamp)
                    throw error;
                if (isRetriableError(error))
                    return attempt.apply(undefined, args);
                throw error;
            }
        };
    };
};
