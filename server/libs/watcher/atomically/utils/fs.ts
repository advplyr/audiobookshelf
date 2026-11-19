/* IMPORT */
import fs from "node:fs";
import { promisify } from "node:util";
import { attemptifyAsync, attemptifySync } from "./attemptify";
import handlers from "./fs_handlers";
import { retryifyAsync, retryifySync } from "./retryify";

/* FS */
const FS = {
    chmodAttempt: attemptifyAsync(promisify(fs.chmod), handlers.onChangeError),
    chownAttempt: attemptifyAsync(promisify(fs.chown), handlers.onChangeError),
    closeAttempt: attemptifyAsync(promisify(fs.close)),
    fsyncAttempt: attemptifyAsync(promisify(fs.fsync)),
    mkdirAttempt: attemptifyAsync(promisify(fs.mkdir)),
    realpathAttempt: attemptifyAsync<[fs.PathLike], string>(promisify<typeof fs.realpath.__promisify__>(fs.realpath)),
    statAttempt: attemptifyAsync<[fs.PathLike], fs.Stats>(promisify<typeof fs.stat.__promisify__>(fs.stat)),
    unlinkAttempt: attemptifyAsync(promisify(fs.unlink)),
    closeRetry: retryifyAsync(promisify(fs.close), handlers.isRetriableError),
    fsyncRetry: retryifyAsync(promisify(fs.fsync), handlers.isRetriableError),
    openRetry: retryifyAsync(promisify(fs.open), handlers.isRetriableError),
    readFileRetry: retryifyAsync(promisify<typeof fs.readFile.__promisify__>(fs.readFile), handlers.isRetriableError),
    renameRetry: retryifyAsync(promisify(fs.rename), handlers.isRetriableError),
    statRetry: retryifyAsync(promisify<typeof fs.stat.__promisify__>(fs.stat), handlers.isRetriableError),
    writeRetry: retryifyAsync(promisify<typeof fs.write.__promisify__>(fs.write), handlers.isRetriableError),
    chmodSyncAttempt: attemptifySync(fs.chmodSync, handlers.onChangeError),
    chownSyncAttempt: attemptifySync(fs.chownSync, handlers.onChangeError),
    closeSyncAttempt: attemptifySync(fs.closeSync),
    mkdirSyncAttempt: attemptifySync(fs.mkdirSync),
    realpathSyncAttempt: attemptifySync<[fs.PathLike], string>(fs.realpathSync),
    statSyncAttempt: attemptifySync<[fs.PathLike], fs.Stats>(fs.statSync),
    unlinkSyncAttempt: attemptifySync(fs.unlinkSync),
    closeSyncRetry: retryifySync(fs.closeSync, handlers.isRetriableError),
    fsyncSyncRetry: retryifySync(fs.fsyncSync, handlers.isRetriableError),
    openSyncRetry: retryifySync(fs.openSync, handlers.isRetriableError),
    readFileSyncRetry: retryifySync(fs.readFileSync, handlers.isRetriableError),
    renameSyncRetry: retryifySync(fs.renameSync, handlers.isRetriableError),
    statSyncRetry: retryifySync(fs.statSync, handlers.isRetriableError),
    writeSyncRetry: retryifySync(fs.writeSync, handlers.isRetriableError)
};
/* EXPORT */
export default FS;
