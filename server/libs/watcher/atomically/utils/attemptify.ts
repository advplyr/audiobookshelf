import { NOOP } from "../consts";

/* ATTEMPTIFY */
//TODO: Maybe publish this as a standalone package
export const attemptifyAsync = <Args extends unknown[], Result, Fallback = void>(fn: (...args: Args) => Promise<Result>, onError?: (error: unknown) => Fallback) => {
    const handleError = onError === undefined ? NOOP : onError;
    return function (...args: Args) {
        return fn.apply(undefined, args).catch<void | Fallback>(handleError);
    };
};
export const attemptifySync = <Args extends unknown[], Result, Fallback = void>(fn: (...args: Args) => Result, onError?: (error: unknown) => Fallback) => {
    const handleError = onError === undefined ? NOOP : onError;
    return function (...args: Args) {
        try {
            return fn.apply(undefined, args);
        }
        catch (error) {
            return handleError(error);
        }
    };
};
