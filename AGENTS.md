## Description

Self-hosted audiobook and podcast server.

## Goal

Current goal is to migrate backend JavaScript to TypeScript.

## Tech

- Backend: Node.js 24, Express, Sequelize/SQLite, Socket.IO, and strict TypeScript with CommonJS output.
- Frontend: Nuxt 2/Vue 2.
- Testing: Mocha, Chai, Sinon, and ESLint.

## Structure

- `server/`: backend source.
  - `controllers/`, `routers/`: HTTP handlers and routes.
  - `models/`, `Database.js`: Sequelize models and database setup.
  - `auth/`, `Auth.js`: authentication.
  - `managers/`: business services.
  - `scanner/`, `Watcher.js`: media scanning and file watching.
  - `providers/`, `finders/`: metadata providers and lookup.
  - `objects/`, `utils/`: data objects and helpers.
  - `migrations/`: database migration scripts.
  - `types/`: shared type declarations.
  - `libs/`: embedded libraries.
- `client/`: Nuxt frontend.
- `test/server/`: backend tests; `*.types.ts` files contain compile-only type contracts.
- `docs/`: OpenAPI specification.
- `dist-server/`: generated CommonJS backend and tests.

## Commands

Run from the repository root:

- Install: `npm ci`
- Develop: `npm run dev`
- Build: `npm run build:server`
- Start compiled backend: `npm start`
- Type check without emitting JS or using incremental cache: `npm run typecheck:server`
- Remove generated `dist-server/` output: `npm run clean:server` (run before rebuilding after source renames/deletions).
- Lint changed files: `npx --no-install eslint <files>`
- Run targeted tests after building: `npx --no-install mocha dist-server/test/server/utils/requestUtils.test.js` (replace with relevant tests).
- Full backend checks when warranted: `npm run lint` and `npm test`.

Check local paths in `dev.js` before startup. Use isolated configuration, databases, and media for startup, scanning, and migration tests.

## Rules

- Never change the repository architecture or refactor code. Perform only migration work, preserving existing structure and runtime behavior.
- Do not update any docs in this repository without permission.
- Please let me know after the migration task is complete whether manual testing is required, as well as the scope of such testing.
- Use one small, reviewable batch per task: usually 3-8 simple files or 1-2 complex files.
- Preserve existing architecture, unrelated changes, export shapes, and runtime behavior.
- Retain strict checking. Do not conceal missing types with `any`, suppression directives, or unjustified assertions.
- Use `import type` for dependencies needed only as types.
- Keep existing JS tests when they already verify behavior; migrate tests only when useful.
- Do not create branches or commits without explicit authorization.
- Use temporary databases and media directories for startup, scanning, and migration checks.
- Consult [migration-plan.md](docs/migration-plan.md) for migration phases, scope, and validation details when more context is needed.
