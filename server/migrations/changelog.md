# Migrations Changelog

Please add a record of every database migration that you create to this file. This will help us keep track of changes to the database schema over time.

| Server Version | Migration Script Name        | Description                                                                          |
| -------------- | ---------------------------- | ------------------------------------------------------------------------------------ |
| v2.15.0        | v2.15.0-series-column-unique | Series must have unique names in the same library                                    |
| v2.15.1        | v2.15.1-reindex-nocase       | Fix potential db corruption issues due to bad sqlite extension introduced in v2.12.0 |
