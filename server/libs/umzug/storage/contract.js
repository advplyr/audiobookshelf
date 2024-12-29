"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyUmzugStorage = exports.isUmzugStorage = void 0;
function isUmzugStorage(arg) {
    return (arg &&
        typeof arg.logMigration === 'function' &&
        typeof arg.unlogMigration === 'function' &&
        typeof arg.executed === 'function');
}
exports.isUmzugStorage = isUmzugStorage;
const verifyUmzugStorage = (arg) => {
    if (!isUmzugStorage(arg)) {
        throw new Error(`Invalid umzug storage`);
    }
    return arg;
};
exports.verifyUmzugStorage = verifyUmzugStorage;
//# sourceMappingURL=contract.js.map