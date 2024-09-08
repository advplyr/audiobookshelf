"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSONStorage = void 0;
const fs_1 = require("fs");
const path = __importStar(require("path"));
const filesystem = {
    /** reads a file as a string or returns null if file doesn't exist */
    async readAsync(filepath) {
        return fs_1.promises.readFile(filepath).then(c => c.toString(), () => null);
    },
    /** writes a string as file contents, creating its parent directory if necessary */
    async writeAsync(filepath, content) {
        await fs_1.promises.mkdir(path.dirname(filepath), { recursive: true });
        await fs_1.promises.writeFile(filepath, content);
    },
};
class JSONStorage {
    constructor(options) {
        var _a;
        this.path = (_a = options === null || options === void 0 ? void 0 : options.path) !== null && _a !== void 0 ? _a : path.join(process.cwd(), 'umzug.json');
    }
    async logMigration({ name: migrationName }) {
        const loggedMigrations = await this.executed();
        loggedMigrations.push(migrationName);
        await filesystem.writeAsync(this.path, JSON.stringify(loggedMigrations, null, 2));
    }
    async unlogMigration({ name: migrationName }) {
        const loggedMigrations = await this.executed();
        const updatedMigrations = loggedMigrations.filter(name => name !== migrationName);
        await filesystem.writeAsync(this.path, JSON.stringify(updatedMigrations, null, 2));
    }
    async executed() {
        const content = await filesystem.readAsync(this.path);
        return content ? JSON.parse(content) : [];
    }
}
exports.JSONStorage = JSONStorage;
//# sourceMappingURL=json.js.map