/* IMPORT */
import { IS_USER_ROOT } from "../consts";
/* FS HANDLERS */
const Handlers = {
    isChangeErrorOk: (error: NodeJS.ErrnoException) => {
        const { code } = error;
        if (code === 'ENOSYS')
            return true;
        if (!IS_USER_ROOT && (code === 'EINVAL' || code === 'EPERM'))
            return true;
        return false;
    },
    isRetriableError: (error: NodeJS.ErrnoException) => {
        const { code } = error;
        if (code === 'EMFILE' || code === 'ENFILE' || code === 'EAGAIN' || code === 'EBUSY' || code === 'EACCESS' || code === 'EACCS' || code === 'EPERM')
            return true;
        return false;
    },
    onChangeError: (error: NodeJS.ErrnoException) => {
        if (Handlers.isChangeErrorOk(error))
            return;
        throw error;
    }
};
/* EXPORT */
export default Handlers;
