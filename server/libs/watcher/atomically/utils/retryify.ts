/* IMPORT */
import RetryfyQueue from "./retryify_queue";

/* RETRYIFY */
export const retryifyAsync = <Fn extends (...args: never[]) => Promise<unknown>>(fn: Fn, isRetriableError: (error: unknown) => boolean) => {
    const operation = fn as (...args: Parameters<Fn>) => Promise<unknown>;
    return function (timestamp: number): Fn {
        // The wrapper forwards the arguments and result of every overload unchanged.
        return function attempt(...args: Parameters<Fn>): Promise<unknown> {
            return RetryfyQueue.schedule().then(cleanup => {
                return operation.apply(undefined, args).then(result => {
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
        } as Fn;
    };
};
export const retryifySync = <Fn extends (...args: never[]) => unknown>(fn: Fn, isRetriableError: (error: unknown) => boolean) => {
    const operation = fn as (...args: Parameters<Fn>) => unknown;
    return function (timestamp: number): Fn {
        return function attempt(...args: Parameters<Fn>): unknown {
            try {
                return operation.apply(undefined, args);
            }
            catch (error) {
                if (Date.now() > timestamp)
                    throw error;
                if (isRetriableError(error))
                    return attempt.apply(undefined, args);
                throw error;
            }
        } as Fn;
    };
};
