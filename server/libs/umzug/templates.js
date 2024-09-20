'use strict'
/* eslint-disable unicorn/template-indent */
// templates for migration file creation
Object.defineProperty(exports, '__esModule', { value: true })
exports.sqlDown = exports.sqlUp = exports.mjs = exports.ts = exports.js = void 0
exports.js = `
/** @type {import('umzug').MigrationFn<any>} */
exports.up = async params => {};

/** @type {import('umzug').MigrationFn<any>} */
exports.down = async params => {};
`.trimStart()
exports.ts = `
import type { MigrationFn } from 'umzug';

export const up: MigrationFn = async params => {};
export const down: MigrationFn = async params => {};
`.trimStart()
exports.mjs = `
/** @type {import('umzug').MigrationFn<any>} */
export const up = async params => {};

/** @type {import('umzug').MigrationFn<any>} */
export const down = async params => {};
`.trimStart()
exports.sqlUp = `
-- up migration
`.trimStart()
exports.sqlDown = `
-- down migration
`.trimStart()
//# sourceMappingURL=templates.js.map
