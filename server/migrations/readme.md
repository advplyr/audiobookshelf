# Database Migrations

This directory contains all the database migration scripts for the server.

## What is a migration?

A migration is a script that changes the structure of the database. This can include creating tables, adding columns, or modifying existing columns. A migration script consists of two parts: an "up" script that applies the changes to the database, and a "down" script that undoes the changes.

## Guidelines for writing migrations

When writing a migration, keep the following guidelines in mind:

- You **_must_** name your migration script according to the following convention: `<server_version>-<migration_name>.js`. For example, `v2.14.0-create-users-table.js`.

  - `server_version` should be the version of the server that the migration was created for (this should usually be the next server release).
  - `migration_name` should be a short description of the changes that the migration makes.

- The script should export two async functions: `up` and `down`. The `up` function should contain the script that applies the changes to the database, and the `down` function should contain the script that undoes the changes. The `up` and `down` functions should accept a single object parameter with a `context` property that contains a reference to a Sequelize [`QueryInterface`](https://sequelize.org/docs/v6/other-topics/query-interface/) object, and a [Logger](https://github.com/advplyr/audiobookshelf/blob/423a2129d10c6d8aaac9e8c75941fa6283889602/server/Logger.js#L4) object for logging. A typical migration script might look like this:

  ```javascript
  async function up({ context: { queryInterface, logger } }) {
    // Upwards migration script
    logger.info('migrating ...');
    ...
  }

  async function down({ context: { queryInterface, logger } }) {
    // Downward migration script
    logger.info('reverting ...');
    ...
  }

  module.exports = {up, down}
  ```

- Always implement both the `up` and `down` functions.
- The `up` and `down` functions should be idempotent (i.e., they should be safe to run multiple times).
- Prefer using only `queryInterface` and `logger` parameters, the `sequelize` module, and node.js built-in modules in your migration scripts. You can require other modules, but be aware that they might not be available or change from they ones you tested with.
- It's your responsibility to make sure that the down migration reverts the changes made by the up migration.
- Log detailed information on every step of the migration. Use `Logger.info()` and `Logger.error()`.
- Test tour migrations thoroughly before committing them.
  - write unit tests for your migrations (see `test/server/migrations` for an example)
  - you can force a server version change by modifying the `version` field in `package.json` on your dev environment (but don't forget to revert it back before committing)

## How migrations are run

Migrations are run automatically when the server starts, when the server detects that the server version has changed. Migrations are always run in server version order (from oldest to newest up migrations if the server version increased, and from newest to oldest down migrations if the server version decreased). Only the relevant migrations are run, based on the new and old server versions.

This means that you can switch between server releases without having to worry about running migrations manually. The server will automatically apply the necessary migrations when it starts.
