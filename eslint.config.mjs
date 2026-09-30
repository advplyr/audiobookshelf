import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'

const nodeGlobals = {
  AbortController: 'readonly',
  Buffer: 'readonly',
  TextDecoder: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  __dirname: 'readonly',
  clearInterval: 'readonly',
  clearTimeout: 'readonly',
  console: 'readonly',
  process: 'readonly',
  setInterval: 'readonly',
  setTimeout: 'readonly',
  structuredClone: 'readonly'
}

const mochaGlobals = {
  after: 'readonly',
  afterEach: 'readonly',
  before: 'readonly',
  beforeEach: 'readonly',
  describe: 'readonly',
  it: 'readonly'
}

const rules = {
  'no-undef': 'error',
  'no-redeclare': 'error',
  'no-dupe-keys': 'error',
  'no-dupe-class-members': 'error',
  'no-global-assign': 'error'
}

export default [
  {
    files: ['server/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      sourceType: 'module',
      parserOptions: {
        project: './tsconfig.server.json',
        tsconfigRootDir: import.meta.dirname
      }
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...tsPlugin.configs['recommended-type-checked'].rules,
      '@typescript-eslint/no-explicit-any': 'error',
      // Keep coercion diagnostics visible while preserving behavior during migration.
      '@typescript-eslint/no-base-to-string': 'warn'
    }
  },
  {
    ignores: ['**/node_modules/**', 'client/**', 'dist/**', 'dist-server/**', 'coverage/**', 'server/libs/**']
  },
  {
    files: ['index.js', 'prod.js', 'dev.js', 'server/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: nodeGlobals
    },
    rules
  },
  {
    files: ['test/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...nodeGlobals,
        ...mochaGlobals
      }
    },
    rules
  }
]
