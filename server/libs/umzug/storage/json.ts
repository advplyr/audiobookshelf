import { promises as fs } from 'node:fs';
import path from 'node:path';

const filesystem = {
    /** reads a file as a string or returns null if file doesn't exist */
    readAsync(filepath: string) {
        return fs.readFile(filepath).then(c => c.toString(), () => null);
    },
    /** writes a string as file contents, creating its parent directory if necessary */
    async writeAsync(filepath: string, content: string) {
        await fs.mkdir(path.dirname(filepath), { recursive: true });
        await fs.writeFile(filepath, content);
    },
};
export class JSONStorage {
    path: string;

    constructor(options?: { path?: string }) {
        this.path = options?.path ?? path.join(process.cwd(), 'umzug.json');
    }
    async logMigration({ name: migrationName }: { name: string }) {
        const loggedMigrations = await this.executed();
        loggedMigrations.push(migrationName);
        await filesystem.writeAsync(this.path, JSON.stringify(loggedMigrations, null, 2));
    }
    async unlogMigration({ name: migrationName }: { name: string }) {
        const loggedMigrations = await this.executed();
        const updatedMigrations = loggedMigrations.filter(name => name !== migrationName);
        await filesystem.writeAsync(this.path, JSON.stringify(updatedMigrations, null, 2));
    }
    async executed() {
        const content = await filesystem.readAsync(this.path);
        // The storage file contains the migration names written by this class.
        return content ? JSON.parse(content) as string[] : [];
    }
}
