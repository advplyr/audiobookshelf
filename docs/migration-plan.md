# Migration Plan

## Objective and baseline

Migrate backend JavaScript to strict TypeScript while preserving runtime behavior, API responses, database compatibility, CommonJS exports, and initialization order.

The scan found 428 backend JS files: 181 application files under `server/`, 244 embedded-library files under `server/libs/`, and 3 root entry/configuration files. Backend tests contain 35 JS files, including 30 test suites and 5 helpers. Frontend files and generated output are outside this scope.

The project already supports mixed JS/TS compilation to `dist-server/`. `server/utils/requestUtils.ts` and its compile-time type contract provide the first migration example. Existing JS is not globally checked with `checkJs`. A successful type check does not establish complete coverage of unmigrated JS.

## Inventory

| Category | Directory | JS files |
| --- | --- | --- |
| Utilities | server/utils/ | 45  |
| Sequelize models | server/models/ | 25  |
| Controllers | server/controllers/ | 23  |
| Data and runtime objects | server/objects/ | 18  |
| Managers | server/managers/ | 18  |
| Database migration scripts | server/migrations/ | 15  |
| Media scanning | server/scanner/ | 13  |
| Metadata providers | server/providers/ | 9   |
| Core modules | server/ directly | 6   |
| Authentication strategies | server/auth/ | 3   |
| Finders | server/finders/ | 3   |
| Routers | server/routers/ | 3   |
| Embedded libraries | server/libs/ | 244 |
| Root entry/configuration files | index.js, dev.js, prod.js | 3   |
| **Total** |     | **428** |

## Migration phases

Directories below are relative to the repository root. Track individual files within each phase; a phase is not a single batch.

| Phase | Scope | Order and acceptance focus |
| --- | --- | --- |
| 0. Preparation | tsconfig.server.json, eslint.config.mjs, shared type declarations | Establish baseline checks; define global variables, external-library interfaces, and Express request extensions as needed. Ensure ambient declaration files are loaded. |
| 1. Foundation | Direct server/utils/ files, server/Logger.js | Start with constants.js, globals.js, areEquivalent.js, and parseSeriesString.js; then Logger and other low-dependency utilities. Defer queries and migration helpers. Verify edge cases and export compatibility. |
| 2. Objects and parsing | server/objects/files/, server/objects/metadata/, low-dependency direct objects, server/utils/parsers/, server/utils/generators/ | File/metadata objects first, then parsers and generators. Verify parsing, serialization, and missing fields. Defer business-dependent settings objects. |
| 3. Data layer | server/models/, server/Database.js, server/utils/queries/, server/objects/settings/ | Simple models and join tables before complex models; coordinate Database, query, and settings types in small batches. Verify associations, reads/writes, query results, and legacy JSON serialization. |
| 4. Authentication and sockets | server/auth/, server/Auth.js, server/SocketAuthority.js | TokenManager, authentication strategies, Auth, then SocketAuthority. Verify login, refresh, logout, permissions, and socket authentication. |
| 5. Business services | server/providers/, server/finders/, server/managers/, remaining business objects | Providers, finders, simple managers, then complex playback/podcast services. Defer MigrationManager and scanning-coupled managers to their relevant phases. Verify parsing, caching, state transitions, and failures. |
| 6. Scanning and watching | server/scanner/, server/Watcher.js, scanning-coupled managers | Scan data and probe objects, individual scanners, library scanning/orchestration, then Watcher. Verify first scan, repeat scan, file changes, and malformed media. |
| 7. Interfaces and startup | server/controllers/, server/routers/, server/Server.js, index.js, dev.js, prod.js | Small controllers before large controllers, then routers, Server, and entry files. Verify statuses, response shapes, permissions, startup, and build paths. |
| 8. Historical migrations | server/migrations/, server/utils/migrations/, server/managers/MigrationManager.js | Verify upgrade/downgrade and compiled migration discovery/copying. Keep runtime migration filenames as compiled .js files. |
| Separate library workstream | server/libs/ | Provide accurate boundary types first. If complete source conversion is required, migrate one library at a time after application types stabilize. |
