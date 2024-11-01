'use strict'
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k
        var desc = Object.getOwnPropertyDescriptor(m, k)
        if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k]
            }
          }
        }
        Object.defineProperty(o, k2, desc)
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k
        o[k2] = m[k]
      })
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v })
      }
    : function (o, v) {
        o['default'] = v
      })
var __importStar =
  (this && this.__importStar) ||
  function (mod) {
    if (mod && mod.__esModule) return mod
    var result = {}
    if (mod != null) for (var k in mod) if (k !== 'default' && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k)
    __setModuleDefault(result, mod)
    return result
  }
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
var _a
Object.defineProperty(exports, '__esModule', { value: true })
exports.Umzug = exports.MigrationError = void 0
const fs = __importStar(require('fs'))
const path = __importStar(require('path'))
const storage_1 = require('./storage')
const templates = __importStar(require('./templates'))
const types_1 = require('./types')
class MigrationError extends Error {
  // TODO [>=4.0.0] Take a `{ cause: ... }` options bag like the default `Error`, it looks like this because of verror backwards-compatibility.
  constructor(migration, original) {
    super(`Migration ${migration.name} (${migration.direction}) failed: ${MigrationError.errorString(original)}`, {
      cause: original
    })
    this.name = 'MigrationError'
    this.migration = migration
  }
  // TODO [>=4.0.0] Remove this backwards-compatibility alias
  get info() {
    return this.migration
  }
  static errorString(cause) {
    return cause instanceof Error ? `Original error: ${cause.message}` : `Non-error value thrown. See info for full props: ${cause}`
  }
}
exports.MigrationError = MigrationError
class Umzug {
  /** creates a new Umzug instance */
  constructor(options) {
    var _b
    this.options = options
    this.storage = (0, storage_1.verifyUmzugStorage)((_b = options.storage) !== null && _b !== void 0 ? _b : new storage_1.JSONStorage())
    this.migrations = this.getMigrationsResolver(this.options.migrations)
  }
  logging(message) {
    var _b
    ;(_b = this.options.logger) === null || _b === void 0 ? void 0 : _b.info(message)
  }
  /** Get the list of migrations which have already been applied */
  async executed() {
    return this.runCommand('executed', async ({ context }) => {
      const list = await this._executed(context)
      // We do the following to not expose the `up` and `down` functions to the user
      return list.map((m) => ({ name: m.name, path: m.path }))
    })
  }
  /** Get the list of migrations which have already been applied */
  async _executed(context) {
    const [migrations, executedNames] = await Promise.all([this.migrations(context), this.storage.executed({ context })])
    const executedSet = new Set(executedNames)
    return migrations.filter((m) => executedSet.has(m.name))
  }
  /** Get the list of migrations which are yet to be applied */
  async pending() {
    return this.runCommand('pending', async ({ context }) => {
      const list = await this._pending(context)
      // We do the following to not expose the `up` and `down` functions to the user
      return list.map((m) => ({ name: m.name, path: m.path }))
    })
  }
  async _pending(context) {
    const [migrations, executedNames] = await Promise.all([this.migrations(context), this.storage.executed({ context })])
    const executedSet = new Set(executedNames)
    return migrations.filter((m) => !executedSet.has(m.name))
  }
  async runCommand(command, cb) {
    const context = await this.getContext()
    return await cb({ context })
  }
  /**
   * Apply migrations. By default, runs all pending migrations.
   * @see MigrateUpOptions for other use cases using `to`, `migrations` and `rerun`.
   */
  async up(options = {}) {
    const eligibleMigrations = async (context) => {
      var _b
      if (options.migrations && options.rerun === types_1.RerunBehavior.ALLOW) {
        // Allow rerun means the specified migrations should be run even if they've run before - so get all migrations, not just pending
        const list = await this.migrations(context)
        return this.findMigrations(list, options.migrations)
      }
      if (options.migrations && options.rerun === types_1.RerunBehavior.SKIP) {
        const executedNames = new Set((await this._executed(context)).map((m) => m.name))
        const filteredMigrations = options.migrations.filter((m) => !executedNames.has(m))
        return this.findMigrations(await this.migrations(context), filteredMigrations)
      }
      if (options.migrations) {
        return this.findMigrations(await this._pending(context), options.migrations)
      }
      const allPending = await this._pending(context)
      let sliceIndex = (_b = options.step) !== null && _b !== void 0 ? _b : allPending.length
      if (options.to) {
        sliceIndex = this.findNameIndex(allPending, options.to) + 1
      }
      return allPending.slice(0, sliceIndex)
    }
    return this.runCommand('up', async ({ context }) => {
      const toBeApplied = await eligibleMigrations(context)
      for (const m of toBeApplied) {
        const start = Date.now()
        const params = { name: m.name, path: m.path, context }
        this.logging({ event: 'migrating', name: m.name })
        try {
          await m.up(params)
        } catch (e) {
          throw new MigrationError({ direction: 'up', ...params }, e)
        }
        await this.storage.logMigration(params)
        const duration = (Date.now() - start) / 1000
        this.logging({ event: 'migrated', name: m.name, durationSeconds: duration })
      }
      return toBeApplied.map((m) => ({ name: m.name, path: m.path }))
    })
  }
  /**
   * Revert migrations. By default, the last executed migration is reverted.
   * @see MigrateDownOptions for other use cases using `to`, `migrations` and `rerun`.
   */
  async down(options = {}) {
    const eligibleMigrations = async (context) => {
      var _b
      if (options.migrations && options.rerun === types_1.RerunBehavior.ALLOW) {
        const list = await this.migrations(context)
        return this.findMigrations(list, options.migrations)
      }
      if (options.migrations && options.rerun === types_1.RerunBehavior.SKIP) {
        const pendingNames = new Set((await this._pending(context)).map((m) => m.name))
        const filteredMigrations = options.migrations.filter((m) => !pendingNames.has(m))
        return this.findMigrations(await this.migrations(context), filteredMigrations)
      }
      if (options.migrations) {
        return this.findMigrations(await this._executed(context), options.migrations)
      }
      const executedReversed = (await this._executed(context)).slice().reverse()
      let sliceIndex = (_b = options.step) !== null && _b !== void 0 ? _b : 1
      if (options.to === 0 || options.migrations) {
        sliceIndex = executedReversed.length
      } else if (options.to) {
        sliceIndex = this.findNameIndex(executedReversed, options.to) + 1
      }
      return executedReversed.slice(0, sliceIndex)
    }
    return this.runCommand('down', async ({ context }) => {
      var _b
      const toBeReverted = await eligibleMigrations(context)
      for (const m of toBeReverted) {
        const start = Date.now()
        const params = { name: m.name, path: m.path, context }
        this.logging({ event: 'reverting', name: m.name })
        try {
          await ((_b = m.down) === null || _b === void 0 ? void 0 : _b.call(m, params))
        } catch (e) {
          throw new MigrationError({ direction: 'down', ...params }, e)
        }
        await this.storage.unlogMigration(params)
        const duration = Number.parseFloat(((Date.now() - start) / 1000).toFixed(3))
        this.logging({ event: 'reverted', name: m.name, durationSeconds: duration })
      }
      return toBeReverted.map((m) => ({ name: m.name, path: m.path }))
    })
  }
  async create(options) {
    await this.runCommand('create', async ({ context }) => {
      var _b, _c, _d, _e
      const isoDate = new Date().toISOString()
      const prefixes = {
        TIMESTAMP: isoDate.replace(/\.\d{3}Z$/, '').replace(/\W/g, '.'),
        DATE: isoDate.split('T')[0].replace(/\W/g, '.'),
        NONE: ''
      }
      const prefixType = (_b = options.prefix) !== null && _b !== void 0 ? _b : 'TIMESTAMP'
      const fileBasename = [prefixes[prefixType], options.name].filter(Boolean).join('.')
      const allowedExtensions = options.allowExtension ? [options.allowExtension] : ['.js', '.cjs', '.mjs', '.ts', '.cts', '.mts', '.sql']
      const existing = await this.migrations(context)
      const last = existing.slice(-1)[0]
      const folder = options.folder || ((_c = this.options.create) === null || _c === void 0 ? void 0 : _c.folder) || ((last === null || last === void 0 ? void 0 : last.path) && path.dirname(last.path))
      if (!folder) {
        throw new Error(`Couldn't infer a directory to generate migration file in. Pass folder explicitly`)
      }
      const filepath = path.join(folder, fileBasename)
      if (!options.allowConfusingOrdering) {
        const confusinglyOrdered = existing.find((e) => e.path && e.path >= filepath)
        if (confusinglyOrdered) {
          throw new Error(`Can't create ${fileBasename}, since it's unclear if it should run before or after existing migration ${confusinglyOrdered.name}. Use allowConfusingOrdering to bypass this error.`)
        }
      }
      const template =
        typeof options.content === 'string'
          ? async () => [[filepath, options.content]]
          : // eslint-disable-next-line @typescript-eslint/unbound-method
          (_e = (_d = this.options.create) === null || _d === void 0 ? void 0 : _d.template) !== null && _e !== void 0
          ? _e
          : Umzug.defaultCreationTemplate
      const toWrite = await template(filepath)
      if (toWrite.length === 0) {
        toWrite.push([filepath, ''])
      }
      toWrite.forEach((pair) => {
        if (!Array.isArray(pair) || pair.length !== 2) {
          throw new Error(`Expected [filepath, content] pair. Check that the file template function returns an array of pairs.`)
        }
        const ext = path.extname(pair[0])
        if (!allowedExtensions.includes(ext)) {
          const allowStr = allowedExtensions.join(', ')
          const message = `Extension ${ext} not allowed. Allowed extensions are ${allowStr}. See help for allowExtension to avoid this error.`
          throw new Error(message)
        }
        fs.mkdirSync(path.dirname(pair[0]), { recursive: true })
        fs.writeFileSync(pair[0], pair[1])
        this.logging({ event: 'created', path: pair[0] })
      })
      if (!options.skipVerify) {
        const [firstFilePath] = toWrite[0]
        const pending = await this._pending(context)
        if (!pending.some((p) => p.path && path.resolve(p.path) === path.resolve(firstFilePath))) {
          const paths = pending.map((p) => p.path).join(', ')
          throw new Error(`Expected ${firstFilePath} to be a pending migration but it wasn't! Pending migration paths: ${paths}. You should investigate this. Use skipVerify to bypass this error.`)
        }
      }
    })
  }
  static defaultCreationTemplate(filepath) {
    const ext = path.extname(filepath)
    if ((ext === '.js' && typeof require.main === 'object') || ext === '.cjs') {
      return [[filepath, templates.js]]
    }
    if (ext === '.ts' || ext === '.mts' || ext === '.cts') {
      return [[filepath, templates.ts]]
    }
    if ((ext === '.js' && require.main === undefined) || ext === '.mjs') {
      return [[filepath, templates.mjs]]
    }
    if (ext === '.sql') {
      const downFilepath = path.join(path.dirname(filepath), 'down', path.basename(filepath))
      return [
        [filepath, templates.sqlUp],
        [downFilepath, templates.sqlDown]
      ]
    }
    return []
  }
  findNameIndex(migrations, name) {
    const index = migrations.findIndex((m) => m.name === name)
    if (index === -1) {
      throw new Error(`Couldn't find migration to apply with name ${JSON.stringify(name)}`)
    }
    return index
  }
  findMigrations(migrations, names) {
    const map = new Map(migrations.map((m) => [m.name, m]))
    return names.map((name) => {
      const migration = map.get(name)
      if (!migration) {
        throw new Error(`Couldn't find migration to apply with name ${JSON.stringify(name)}`)
      }
      return migration
    })
  }
  async getContext() {
    const { context = {} } = this.options
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return typeof context === 'function' ? context() : context
  }
  /** helper for parsing input migrations into a callback returning a list of ready-to-run migrations */
  getMigrationsResolver(inputMigrations) {
    var _b
    if (Array.isArray(inputMigrations)) {
      return async () => inputMigrations
    }
    if (typeof inputMigrations === 'function') {
      // Lazy migrations definition, recurse.
      return async (ctx) => {
        const resolved = await inputMigrations(ctx)
        return this.getMigrationsResolver(resolved)(ctx)
      }
    }
    const paths = inputMigrations.files
    const resolver = (_b = inputMigrations.resolve) !== null && _b !== void 0 ? _b : Umzug.defaultResolver
    return async (context) => {
      paths.sort()
      return paths.map((unresolvedPath) => {
        const filepath = path.resolve(unresolvedPath)
        const name = path.basename(filepath)
        return {
          path: filepath,
          ...resolver({ name, path: filepath, context })
        }
      })
    }
  }
}
exports.Umzug = Umzug
_a = Umzug
Umzug.defaultResolver = ({ name, path: filepath }) => {
  if (!filepath) {
    throw new Error(`Can't use default resolver for non-filesystem migrations`)
  }
  const ext = path.extname(filepath)
  const languageSpecificHelp = {
    '.ts': "TypeScript files can be required by adding `ts-node` as a dependency and calling `require('ts-node/register')` at the program entrypoint before running migrations.",
    '.sql': 'Try writing a resolver which reads file content and executes it as a sql query.'
  }
  languageSpecificHelp['.cts'] = languageSpecificHelp['.ts']
  languageSpecificHelp['.mts'] = languageSpecificHelp['.ts']
  let loadModule
  const jsExt = ext.replace(/\.([cm]?)ts$/, '.$1js')
  const getModule = async () => {
    try {
      return await loadModule()
    } catch (e) {
      if ((e instanceof SyntaxError || e instanceof MissingResolverError) && ext in languageSpecificHelp) {
        e.message += '\n\n' + languageSpecificHelp[ext]
      }
      throw e
    }
  }
  if ((jsExt === '.js' && typeof require.main === 'object') || jsExt === '.cjs') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    loadModule = async () => require(filepath)
  } else if (jsExt === '.js' || jsExt === '.mjs') {
    loadModule = async () => import(filepath)
  } else {
    loadModule = async () => {
      throw new MissingResolverError(filepath)
    }
  }
  return {
    name,
    path: filepath,
    up: async ({ context }) => (await getModule()).up({ path: filepath, name, context }),
    down: async ({ context }) => {
      var _b, _c
      return (_c = (_b = await getModule()).down) === null || _c === void 0 ? void 0 : _c.call(_b, { path: filepath, name, context })
    }
  }
}
class MissingResolverError extends Error {
  constructor(filepath) {
    super(`No resolver specified for file ${filepath}. See docs for guidance on how to write a custom resolver.`)
  }
}
//# sourceMappingURL=umzug.js.map
