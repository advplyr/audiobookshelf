interface MigrationRecord {
    migrationName: string;
}

interface MigrationCollection {
    insertOne(record: MigrationRecord): Promise<unknown>;
    deleteOne(record: MigrationRecord): Promise<unknown>;
    find(filter: Record<string, never>): {
        sort(options: { migrationName: 1 }): { toArray(): Promise<MigrationRecord[]> };
    };
}

interface Connection {
    collection(name: string): MigrationCollection;
}

type StorageOptions = { collectionName?: string } & (
    | { collection: MigrationCollection; connection?: Connection }
    | { collection?: undefined; connection: Connection }
);

function isMongoDBCollectionOptions(arg: StorageOptions): arg is StorageOptions & { collection: MigrationCollection } {
    return Boolean(arg.collection);
}
export class MongoDBStorage {
    collection: MigrationCollection;
    connection: Connection | undefined;
    collectionName: string;

    constructor(options: StorageOptions) {
        if (!options || (!options.collection && !options.connection)) {
            throw new Error('MongoDB Connection or Collection required');
        }
        this.collection = isMongoDBCollectionOptions(options)
            ? options.collection
            : options.connection.collection(options.collectionName ?? 'migrations');
        this.connection = options.connection; // TODO remove this
        this.collectionName = options.collectionName ?? 'migrations'; // TODO remove this
    }
    async logMigration({ name: migrationName }: { name: string }) {
        await this.collection.insertOne({ migrationName });
    }
    async unlogMigration({ name: migrationName }: { name: string }) {
        await this.collection.deleteOne({ migrationName });
    }
    async executed() {
        const records = await this.collection.find({}).sort({ migrationName: 1 }).toArray();
        return records.map(r => r.migrationName);
    }
}
