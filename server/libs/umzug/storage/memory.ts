import type { MigrationStorage } from './contract';

export const memoryStorage = (): MigrationStorage => {
    let executed: string[] = [];
    return {
        logMigration({ name }) {
            executed.push(name);
            return Promise.resolve();
        },
        unlogMigration({ name }) {
            executed = executed.filter(n => n !== name);
            return Promise.resolve();
        },
        executed: () => Promise.resolve([...executed]),
    };
};
