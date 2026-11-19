/* IMPORT */
import { IS_USER_ROOT } from "../consts";
/* FS HANDLERS */
const Handlers = {
    isChangeErrorOk: (error: unknown) => {
        const { code } = error as NodeJS.ErrnoException;
        if (code === 'ENOSYS')
            return true;
        if (!IS_USER_ROOT && (code === 'EINVAL' || code === 'EPERM'))
            return true;
        return false;
    },
    isRetriableError: (error: unknown) => {
        const { code } = error as NodeJS.ErrnoException;
        if (code === 'EMFILE' || code === 'ENFILE' || code === 'EAGAIN' || code === 'EBUSY' || code === 'EACCESS' || code === 'EACCS' || code === 'EPERM')
            return true;
        return false;
    },
    onChangeError: (error: unknown) => {
        if (Handlers.isChangeErrorOk(error))
            return;
        throw error;
    }
};
/* EXPORT */
export default Handlers;
