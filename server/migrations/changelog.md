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
| v2.17.6        | v2.17.6-share-add-isdownloadable             | Adds the isDownloadable column to the mediaItemShares table                                                   |
| v2.17.7        | v2.17.7-add-indices                          | Adds indices to the libraryItems and books tables to reduce query times                                       |
| v2.19.1        | v2.19.1-copy-title-to-library-items          | Copies title and titleIgnorePrefix to the libraryItems table, creates update triggers and indices             |
| v2.19.4        | v2.19.4-improve-podcast-queries              | Adds numEpisodes to podcasts, adds podcastId to mediaProgresses, copies podcast title to libraryItems         |
| v2.20.0        | v2.20.0-improve-author-sort-queries          | Adds AuthorNames(FirstLast\|LastFirst) to libraryItems to improve author sort queries                         |
