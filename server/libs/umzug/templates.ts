// templates for migration file creation
export const js = `
/** @type {import('umzug').MigrationFn<any>} */
exports.up = async params => {};

/** @type {import('umzug').MigrationFn<any>} */
exports.down = async params => {};
`.trimStart()
export const ts = `
import type { MigrationFn } from 'umzug';

export const up: MigrationFn = async params => {};
export const down: MigrationFn = async params => {};
`.trimStart()
export const mjs = `
/** @type {import('umzug').MigrationFn<any>} */
export const up = async params => {};

/** @type {import('umzug').MigrationFn<any>} */
export const down = async params => {};
`.trimStart()
export const sqlUp = `
-- up migration
`.trimStart()
export const sqlDown = `
-- down migration
`.trimStart()
