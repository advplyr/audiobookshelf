export interface MigrationStorage {
    logMigration(params: { name: string }): Promise<void>;
    unlogMigration(params: { name: string }): Promise<void>;
    executed(): Promise<string[]>;
}

export function isUmzugStorage(arg: unknown): arg is MigrationStorage {
    return ((typeof arg === 'object' && arg !== null || typeof arg === 'function') &&
        'logMigration' in arg && typeof arg.logMigration === 'function' &&
        'unlogMigration' in arg && typeof arg.unlogMigration === 'function' &&
        'executed' in arg && typeof arg.executed === 'function');
}
export const verifyUmzugStorage = (arg: unknown) => {
    if (!isUmzugStorage(arg)) {
        throw new Error(`Invalid umzug storage`);
    }
    return arg;
};
