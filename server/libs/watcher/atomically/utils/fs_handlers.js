"use strict";
/* IMPORT */
Object.defineProperty(exports, "__esModule", { value: true });
const consts_1 = require("../consts");
/* FS HANDLERS */
const Handlers = {
    isChangeErrorOk: (error) => {
        const { code } = error;
        if (code === 'ENOSYS')
            return true;
        if (!consts_1.IS_USER_ROOT && (code === 'EINVAL' || code === 'EPERM'))
            return true;
        return false;
    },
    isRetriableError: (error) => {
        const { code } = error;
        if (code === 'EMFILE' || code === 'ENFILE' || code === 'EAGAIN' || code === 'EBUSY' || code === 'EACCESS' || code === 'EACCS' || code === 'EPERM')
            return true;
        return false;
    },
    onChangeError: (error) => {
        if (Handlers.isChangeErrorOk(error))
            return;
        throw error;
    }
};
/* EXPORT */
exports.default = Handlers;
