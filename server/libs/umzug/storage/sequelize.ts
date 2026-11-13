import type { DataType, Model, ModelStatic, Sequelize } from 'sequelize';
import type { MigrationStorage } from './contract';

type StorageOptions = {
    columnType?: DataType;
    columnName?: string;
    timestamps?: boolean;
    modelName?: string;
    tableName?: string;
    schema?: string;
} & ({ sequelize: Sequelize; model?: ModelStatic<Model> } | { sequelize?: undefined; model: ModelStatic<Model> });

type SequelizeInternals = Sequelize & {
    constructor: { DataTypes: typeof import('sequelize').DataTypes };
    dialect?: { name: string };
};

const DIALECTS_WITH_CHARSET_AND_COLLATE = new Set(['mysql', 'mariadb']);
export class SequelizeStorage implements MigrationStorage {
    sequelize: Sequelize;
    columnType: DataType;
    columnName: string;
    timestamps: boolean;
    modelName: string;
    tableName?: string;
    schema?: string;
    model: ModelStatic<Model>;

    /**
      Constructs Sequelize based storage. Migrations will be stored in a SequelizeMeta table using the given instance of Sequelize.
  
      If a model is given, it will be used directly as the model for the SequelizeMeta table. Otherwise, it will be created automatically according to the given options.
  
      If the table does not exist it will be created automatically upon the logging of the first migration.
      */
    constructor(options: StorageOptions) {
        if (!options || (!options.model && !options.sequelize)) {
            throw new Error('One of "sequelize" or "model" storage option is required');
        }
        const sequelize = options.sequelize ?? options.model?.sequelize;
        if (!sequelize) throw new Error('The storage model is not initialized');
        this.sequelize = sequelize;
        this.columnType = options.columnType ?? (this.sequelize as SequelizeInternals).constructor.DataTypes.STRING;
        this.columnName = options.columnName ?? 'name';
        this.timestamps = options.timestamps ?? false;
        this.modelName = options.modelName ?? 'SequelizeMeta';
        this.tableName = options.tableName;
        this.schema = options.schema;
        this.model = options.model ?? this.getModel();
    }
    getModel() {
        if (this.sequelize.isDefined(this.modelName)) {
            return this.sequelize.model(this.modelName);
        }
        const dialectName = (this.sequelize as SequelizeInternals).dialect?.name;
        const hasCharsetAndCollate = dialectName !== undefined && DIALECTS_WITH_CHARSET_AND_COLLATE.has(dialectName);
        return this.sequelize.define(this.modelName, {
            [this.columnName]: {
                type: this.columnType,
                allowNull: false,
                unique: true,
                primaryKey: true,
                autoIncrement: false,
            },
        }, {
            tableName: this.tableName,
            schema: this.schema,
            timestamps: this.timestamps,
            charset: hasCharsetAndCollate ? 'utf8' : undefined,
            collate: hasCharsetAndCollate ? 'utf8_unicode_ci' : undefined,
        });
    }
    async syncModel() {
        await this.model.sync();
    }
    async logMigration({ name: migrationName }: { name: string }) {
        await this.syncModel();
        await this.model.create({
            [this.columnName]: migrationName,
        });
    }
    async unlogMigration({ name: migrationName }: { name: string }) {
        await this.syncModel();
        await this.model.destroy({
            where: {
                [this.columnName]: migrationName,
            },
        });
    }
    async executed() {
        await this.syncModel();
        const migrations = await this.model.findAll({ order: [[this.columnName, 'ASC']] });
        return migrations.map(migration => {
            // The configured column is exposed as a model attribute.
            const name: unknown = Reflect.get(migration, this.columnName);
            if (typeof name !== 'string') {
                throw new TypeError(`Unexpected migration name type: expected string, got ${typeof name}`);
            }
            return name;
        });
    }
    // TODO remove this
    _model() {
        return this.model;
    }
}
