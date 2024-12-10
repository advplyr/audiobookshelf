# Migrations Changelog

Please add a record of every database migration that you create to this file. This will help us keep track of changes to the database schema over time.

| Server Version | Migration Script Name                        | Description                                                                                                   |
| -------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| v2.15.0        | v2.15.0-series-column-unique                 | Series must have unique names in the same library                                                             |
| v2.15.1        | v2.15.1-reindex-nocase                       | Fix potential db corruption issues due to bad sqlite extension introduced in v2.12.0                          |
| v2.15.2        | v2.15.2-index-creation                       | Creates author, series, and podcast episode indexes                                                           |
| v2.17.0        | v2.17.0-uuid-replacement                     | Changes the data type of columns with UUIDv4 to UUID matching the associated model                            |
| v2.17.3        | v2.17.3-fk-constraints                       | Changes the foreign key constraints for tables due to sequelize bug dropping constraints in v2.17.0 migration |
| v2.17.4        | v2.17.4-use-subfolder-for-oidc-redirect-uris | Save subfolder to OIDC redirect URIs to support existing installations                                        |
| v2.17.5        | v2.17.5-remove-host-from-feed-urls           | removes the host (serverAddress) from URL columns in the feeds and feedEpisodes tables                        |
