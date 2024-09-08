"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryStorage = void 0;
const memoryStorage = () => {
    let executed = [];
    return {
        async logMigration({ name }) {
            executed.push(name);
        },
        async unlogMigration({ name }) {
            executed = executed.filter(n => n !== name);
        },
        executed: async () => [...executed],
    };
};
exports.memoryStorage = memoryStorage;
//# sourceMappingURL=memory.js.map