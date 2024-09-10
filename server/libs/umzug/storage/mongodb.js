"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MongoDBStorage = void 0;
function isMongoDBCollectionOptions(arg) {
    return Boolean(arg.collection);
}
class MongoDBStorage {
    constructor(options) {
        var _a, _b;
        if (!options || (!options.collection && !options.connection)) {
            throw new Error('MongoDB Connection or Collection required');
        }
        this.collection = isMongoDBCollectionOptions(options)
            ? options.collection
            : options.connection.collection((_a = options.collectionName) !== null && _a !== void 0 ? _a : 'migrations');
        this.connection = options.connection; // TODO remove this
        this.collectionName = (_b = options.collectionName) !== null && _b !== void 0 ? _b : 'migrations'; // TODO remove this
    }
    async logMigration({ name: migrationName }) {
        await this.collection.insertOne({ migrationName });
    }
    async unlogMigration({ name: migrationName }) {
        await this.collection.deleteOne({ migrationName });
    }
    async executed() {
        const records = await this.collection.find({}).sort({ migrationName: 1 }).toArray();
        return records.map(r => r.migrationName);
    }
}
exports.MongoDBStorage = MongoDBStorage;
//# sourceMappingURL=mongodb.js.map