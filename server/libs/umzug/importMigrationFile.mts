// Keep native import for ESM migrations, including modules with top-level await.
export function importMigrationFile(filepath: string): Promise<unknown> {
  return import(filepath)
}
