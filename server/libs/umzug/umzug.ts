import * as fs from 'node:fs'
import { createRequire } from 'node:module'
import * as path from 'node:path'
import { importMigrationFile } from './importMigrationFile.mjs'
import { JSONStorage, verifyUmzugStorage } from './storage'
import * as templates from './templates'
import { RerunBehavior } from './types'

const load = createRequire(__filename)

interface MigrationMeta {
  name: string
  path?: string
}

interface MigrationParams<Context> extends MigrationMeta {
  context: Context
}

type MigrationFunction<Context> = (params: MigrationParams<Context>) => unknown

interface Migration<Context> extends MigrationMeta {
  up: MigrationFunction<Context>
  down?: MigrationFunction<Context>
}

interface Storage<Context> {
  executed(params: { context: Context }): Promise<string[]>
  logMigration(params: MigrationParams<Context>): Promise<void>
  unlogMigration(params: MigrationParams<Context>): Promise<void>
}

type Resolver<Context> = (params: MigrationParams<Context>) => Migration<Context>
type MigrationInput<Context> =
  | Migration<Context>[]
  | { files: string[]; resolve?: Resolver<Context> }
  | ((context: Context) => MigrationInput<Context> | PromiseLike<MigrationInput<Context>>)

type TemplateFiles = [filepath: string, content: string][]
type Template = (filepath: string) => TemplateFiles | PromiseLike<TemplateFiles>
type Direction = 'up' | 'down'

interface UmzugOptions<Context> {
  context?: Context | (() => Context | PromiseLike<Context>)
  logger?: { info(message: unknown): void }
  storage?: Storage<Context>
  migrations: MigrationInput<Context>
  create?: { folder?: string; template?: Template }
}

interface MigrateOptions {
  migrations?: string[]
  rerun?: (typeof RerunBehavior)[keyof typeof RerunBehavior]
  step?: number
  to?: string | 0
}

interface CreateOptions {
  name: string
  prefix?: 'TIMESTAMP' | 'DATE' | 'NONE'
  allowExtension?: string
  folder?: string
  allowConfusingOrdering?: boolean
  content?: string
  skipVerify?: boolean
}

type MigrationModule<Context> = Pick<Migration<Context>, 'up' | 'down'>

export class MigrationError<Context = unknown> extends Error {
  declare migration: MigrationParams<Context> & { direction: Direction }

  // TODO [>=4.0.0] Take a `{ cause: ... }` options bag like the default `Error`, it looks like this because of verror backwards-compatibility.
  constructor(migration: MigrationParams<Context> & { direction: Direction }, original: unknown) {
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
  static errorString(cause: unknown) {
    return cause instanceof Error ? `Original error: ${cause.message}` : `Non-error value thrown. See info for full props: ${cause as string}`
  }
}
export class Umzug<Context = Record<string, never>> {
  declare options: UmzugOptions<Context>
  declare storage: Storage<Context>
  declare migrations: (context?: Context) => Promise<Migration<Context>[]>
  declare static defaultResolver: <Context>(params: MigrationParams<Context>) => Migration<Context>

  /** creates a new Umzug instance */
  constructor(options: UmzugOptions<Context>) {
    this.options = options
    this.storage = verifyUmzugStorage(options.storage ?? new JSONStorage())
    this.migrations = this.getMigrationsResolver(this.options.migrations)
  }
  logging(message: unknown) {
    this.options.logger?.info(message)
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
  async _executed(context: Context) {
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
  async _pending(context: Context) {
    const [migrations, executedNames] = await Promise.all([this.migrations(context), this.storage.executed({ context })])
    const executedSet = new Set(executedNames)
    return migrations.filter((m) => !executedSet.has(m.name))
  }
  async runCommand<Result>(command: string, cb: (params: { context: Context }) => Result | PromiseLike<Result>) {
    void command
    const context = await this.getContext()
    return await cb({ context })
  }
  /**
   * Apply migrations. By default, runs all pending migrations.
   * @see MigrateUpOptions for other use cases using `to`, `migrations` and `rerun`.
   */
  async up(options: MigrateOptions = {}) {
    const eligibleMigrations = async (context: Context) => {
      if (options.migrations && options.rerun === RerunBehavior.ALLOW) {
        // Allow rerun means the specified migrations should be run even if they've run before - so get all migrations, not just pending
        const list = await this.migrations(context)
        return this.findMigrations(list, options.migrations)
      }
      if (options.migrations && options.rerun === RerunBehavior.SKIP) {
        const executedNames = new Set((await this._executed(context)).map((m) => m.name))
        const filteredMigrations = options.migrations.filter((m) => !executedNames.has(m))
        return this.findMigrations(await this.migrations(context), filteredMigrations)
      }
      if (options.migrations) {
        return this.findMigrations(await this._pending(context), options.migrations)
      }
      const allPending = await this._pending(context)
      let sliceIndex = options.step ?? allPending.length
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
  async down(options: MigrateOptions = {}) {
    const eligibleMigrations = async (context: Context) => {
      if (options.migrations && options.rerun === RerunBehavior.ALLOW) {
        const list = await this.migrations(context)
        return this.findMigrations(list, options.migrations)
      }
      if (options.migrations && options.rerun === RerunBehavior.SKIP) {
        const pendingNames = new Set((await this._pending(context)).map((m) => m.name))
        const filteredMigrations = options.migrations.filter((m) => !pendingNames.has(m))
        return this.findMigrations(await this.migrations(context), filteredMigrations)
      }
      if (options.migrations) {
        return this.findMigrations(await this._executed(context), options.migrations)
      }
      const executedReversed = (await this._executed(context)).slice().reverse()
      let sliceIndex = options.step ?? 1
      if (options.to === 0 || options.migrations) {
        sliceIndex = executedReversed.length
      } else if (options.to) {
        sliceIndex = this.findNameIndex(executedReversed, options.to) + 1
      }
      return executedReversed.slice(0, sliceIndex)
    }
    return this.runCommand('down', async ({ context }) => {
      const toBeReverted = await eligibleMigrations(context)
      for (const m of toBeReverted) {
        const start = Date.now()
        const params = { name: m.name, path: m.path, context }
        this.logging({ event: 'reverting', name: m.name })
        try {
          await m.down?.(params)
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
  async create(options: CreateOptions) {
    await this.runCommand('create', async ({ context }) => {
      const isoDate = new Date().toISOString()
      const prefixes = {
        TIMESTAMP: isoDate.replace(/\.\d{3}Z$/, '').replace(/\W/g, '.'),
        DATE: isoDate.split('T')[0].replace(/\W/g, '.'),
        NONE: ''
      }
      const prefixType = options.prefix ?? 'TIMESTAMP'
      const fileBasename = [prefixes[prefixType], options.name].filter(Boolean).join('.')
      const allowedExtensions = options.allowExtension ? [options.allowExtension] : ['.js', '.cjs', '.mjs', '.ts', '.cts', '.mts', '.sql']
      const existing = await this.migrations(context)
      const last = existing.slice(-1)[0]
      const folder = options.folder || this.options.create?.folder || (last?.path && path.dirname(last.path))
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
          ? (): TemplateFiles => [[filepath, options.content!]]
          : this.options.create?.template ?? Umzug.defaultCreationTemplate
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
  static defaultCreationTemplate(this: void, filepath: string): TemplateFiles {
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
  findNameIndex(migrations: MigrationMeta[], name: string) {
    const index = migrations.findIndex((m) => m.name === name)
    if (index === -1) {
      throw new Error(`Couldn't find migration to apply with name ${JSON.stringify(name)}`)
    }
    return index
  }
  findMigrations(migrations: Migration<Context>[], names: string[]) {
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
    const { context = {} as Context } = this.options
    return typeof context === 'function' ? (context as () => Context | PromiseLike<Context>)() : context
  }
  /** helper for parsing input migrations into a callback returning a list of ready-to-run migrations */
  getMigrationsResolver(inputMigrations: MigrationInput<Context>): (context?: Context) => Promise<Migration<Context>[]> {
    if (Array.isArray(inputMigrations)) {
      return () => Promise.resolve(inputMigrations)
    }
    if (typeof inputMigrations === 'function') {
      // Lazy migrations definition, recurse.
      return async (ctx) => {
        const resolved = await inputMigrations(ctx as Context)
        return this.getMigrationsResolver(resolved)(ctx)
      }
    }
    const paths = inputMigrations.files
    const resolver = inputMigrations.resolve ?? Umzug.defaultResolver
    return async (context) => {
      paths.sort()
      return Promise.resolve(paths.map((unresolvedPath) => {
        const filepath = path.resolve(unresolvedPath)
        const name = path.basename(filepath)
        return {
          path: filepath,
          ...resolver({ name, path: filepath, context: context as Context })
        }
      }))
    }
  }
}
Umzug.defaultResolver = <Context>({ name, path: filepath }: MigrationParams<Context>): Migration<Context> => {
  if (!filepath) {
    throw new Error(`Can't use default resolver for non-filesystem migrations`)
  }
  const ext = path.extname(filepath)
  const languageSpecificHelp: Record<string, string> = {
    '.ts': "TypeScript files can be required by adding `ts-node` as a dependency and calling `require('ts-node/register')` at the program entrypoint before running migrations.",
    '.sql': 'Try writing a resolver which reads file content and executes it as a sql query.'
  }
  languageSpecificHelp['.cts'] = languageSpecificHelp['.ts']
  languageSpecificHelp['.mts'] = languageSpecificHelp['.ts']
  let loadModule: () => Promise<MigrationModule<Context>>
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
    loadModule = () => new Promise((resolve) => resolve(load(filepath) as MigrationModule<Context>))
  } else if (jsExt === '.js' || jsExt === '.mjs') {
    loadModule = async () => await importMigrationFile(filepath) as MigrationModule<Context>
  } else {
    loadModule = () => Promise.reject(new MissingResolverError(filepath))
  }
  return {
    name,
    path: filepath,
    up: async ({ context }) => (await getModule()).up({ path: filepath, name, context }),
    down: async ({ context }) => {
      return (await getModule()).down?.({ path: filepath, name, context })
    }
  }
}
class MissingResolverError extends Error {
  constructor(filepath: string) {
    super(`No resolver specified for file ${filepath}. See docs for guidance on how to write a custom resolver.`)
  }
}
