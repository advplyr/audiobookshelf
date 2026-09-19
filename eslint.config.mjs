import js from '@eslint/js'
import globals from 'globals'
import prettierConfig from 'eslint-config-prettier'

export default [
  // Global ignore patterns (ignoring client, build outputs, vendored libs)
  {
    ignores: [
      '**/node_modules/**',
      'client/**',
      'dist/**',
      'dist-server/**',
      'coverage/**',
      'server/libs/**',
      '**/.tsbuildinfo'
    ]
  },

  // Server and root JavaScript (Node.js CommonJS)
  {
    files: ['index.js', 'prod.js', 'dev.js', 'server/**/*.js'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.es2022
      }
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-console': 'off'
    }
  },

  // Server Tests (Mocha / Chai / Sinon)
  {
    files: ['test/**/*.js'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.mocha,
        ...globals.es2022
      }
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-console': 'off'
    }
  },

  // Prettier config to disable formatting rules that might conflict
  prettierConfig
]
