CREATE TABLE `users` (`id` UUID PRIMARY KEY, `username` VARCHAR(255), `email` VARCHAR(255), `pash` VARCHAR(255), `type` VARCHAR(255), `token` VARCHAR(255), `isActive` TINYINT(1) DEFAULT 0, `isLocked` TINYINT(1) DEFAULT 0, `lastSeen` DATETIME, `permissions` JSON, `bookmarks` JSON, `extraData` JSON, `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL);
CREATE TABLE `libraries` (`id` UUID PRIMARY KEY, `name` VARCHAR(255), `displayOrder` INTEGER, `icon` VARCHAR(255), `mediaType` VARCHAR(255), `provider` VARCHAR(255), `lastScan` DATETIME, `lastScanVersion` VARCHAR(255), `settings` JSON, `extraData` JSON, `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL);
CREATE TABLE `libraryFolders` (`id` UUID PRIMARY KEY, `path` VARCHAR(255), `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL, `libraryId` UUID REFERENCES `libraries` (`id`) ON DELETE CASCADE ON UPDATE CASCADE);
CREATE TABLE `books` (`id` UUID PRIMARY KEY, `title` VARCHAR(255), `titleIgnorePrefix` VARCHAR(255), `subtitle` VARCHAR(255), `publishedYear` VARCHAR(255), `publishedDate` VARCHAR(255), `publisher` VARCHAR(255), `description` TEXT, `isbn` VARCHAR(255), `asin` VARCHAR(255), `language` VARCHAR(255), `explicit` TINYINT(1), `abridged` TINYINT(1), `coverPath` VARCHAR(255), `duration` FLOAT, `narrators` JSON, `audioFiles` JSON, `ebookFile` JSON, `chapters` JSON, `tags` JSON, `genres` JSON, `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL);
CREATE INDEX `books_title` ON `books` (`title` COLLATE `NOCASE`);
CREATE INDEX `books_published_year` ON `books` (`publishedYear`);
CREATE TABLE `podcasts` (`id` UUID PRIMARY KEY, `title` VARCHAR(255), `titleIgnorePrefix` VARCHAR(255), `author` VARCHAR(255), `releaseDate` VARCHAR(255), `feedURL` VARCHAR(255), `imageURL` VARCHAR(255), `description` TEXT, `itunesPageURL` VARCHAR(255), `itunesId` VARCHAR(255), `itunesArtistId` VARCHAR(255), `language` VARCHAR(255), `podcastType` VARCHAR(255), `explicit` TINYINT(1), `autoDownloadEpisodes` TINYINT(1), `autoDownloadSchedule` VARCHAR(255), `lastEpisodeCheck` DATETIME, `maxEpisodesToKeep` INTEGER, `maxNewEpisodesToDownload` INTEGER, `coverPath` VARCHAR(255), `tags` JSON, `genres` JSON, `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL);
CREATE TABLE `podcastEpisodes` (`id` UUID PRIMARY KEY, `index` INTEGER, `season` VARCHAR(255), `episode` VARCHAR(255), `episodeType` VARCHAR(255), `title` VARCHAR(255), `subtitle` VARCHAR(1000), `description` TEXT, `pubDate` VARCHAR(255), `enclosureURL` VARCHAR(255), `enclosureSize` BIGINT, `enclosureType` VARCHAR(255), `publishedAt` DATETIME, `audioFile` JSON, `chapters` JSON, `extraData` JSON, `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL, `podcastId` UUID REFERENCES `podcasts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE);
CREATE INDEX `podcast_episodes_created_at` ON `podcastEpisodes` (`createdAt`);
CREATE TABLE `libraryItems` (`id` UUID PRIMARY KEY, `ino` VARCHAR(255), `path` VARCHAR(255), `relPath` VARCHAR(255), `mediaId` UUIDV4, `mediaType` VARCHAR(255), `isFile` TINYINT(1), `isMissing` TINYINT(1), `isInvalid` TINYINT(1), `mtime` DATETIME, `ctime` DATETIME, `birthtime` DATETIME, `size` BIGINT, `lastScan` DATETIME, `lastScanVersion` VARCHAR(255), `libraryFiles` JSON, `extraData` JSON, `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL, `libraryId` UUID REFERENCES `libraries` (`id`) ON DELETE SET NULL ON UPDATE CASCADE, `libraryFolderId` UUID REFERENCES `libraryFolders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE);
CREATE INDEX `library_items_created_at` ON `libraryItems` (`createdAt`);
CREATE INDEX `library_items_media_id` ON `libraryItems` (`mediaId`);
CREATE INDEX `library_items_library_id_media_type` ON `libraryItems` (`libraryId`, `mediaType`);
CREATE INDEX `library_items_library_id_media_id_media_type` ON `libraryItems` (`libraryId`, `mediaId`, `mediaType`);
CREATE INDEX `library_items_birthtime` ON `libraryItems` (`birthtime`);
CREATE INDEX `library_items_mtime` ON `libraryItems` (`mtime`);
CREATE TABLE `mediaProgresses` (`id` UUID PRIMARY KEY, `mediaItemId` UUIDV4, `mediaItemType` VARCHAR(255), `duration` FLOAT, `currentTime` FLOAT, `isFinished` TINYINT(1), `hideFromContinueListening` TINYINT(1), `ebookLocation` VARCHAR(255), `ebookProgress` FLOAT, `finishedAt` DATETIME, `extraData` JSON, `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL, `userId` UUID REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE);
CREATE INDEX `media_progresses_updated_at` ON `mediaProgresses` (`updatedAt`);
CREATE TABLE `series` (`id` UUID PRIMARY KEY, `name` VARCHAR(255), `nameIgnorePrefix` VARCHAR(255), `description` TEXT, `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL, `libraryId` UUID REFERENCES `libraries` (`id`) ON DELETE CASCADE ON UPDATE CASCADE);
CREATE INDEX `series_name` ON `series` (`name` COLLATE `NOCASE`);
CREATE INDEX `series_library_id` ON `series` (`libraryId`);
CREATE TABLE `bookSeries` (`id` UUID PRIMARY KEY, `sequence` VARCHAR(255), `createdAt` DATETIME NOT NULL, `bookId` UUID REFERENCES `books` (`id`) ON DELETE CASCADE ON UPDATE CASCADE, `seriesId` UUID REFERENCES `series` (`id`) ON DELETE CASCADE ON UPDATE CASCADE, UNIQUE (`bookId`, `seriesId`));
CREATE TABLE `authors` (`id` UUID PRIMARY KEY, `name` VARCHAR(255), `lastFirst` VARCHAR(255), `asin` VARCHAR(255), `description` TEXT, `imagePath` VARCHAR(255), `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL, `libraryId` UUID REFERENCES `libraries` (`id`) ON DELETE CASCADE ON UPDATE CASCADE);
CREATE INDEX `authors_name` ON `authors` (`name` COLLATE `NOCASE`);
CREATE INDEX `authors_library_id` ON `authors` (`libraryId`);
CREATE TABLE `bookAuthors` (`id` UUID PRIMARY KEY, `createdAt` DATETIME NOT NULL, `bookId` UUID REFERENCES `books` (`id`) ON DELETE CASCADE ON UPDATE CASCADE, `authorId` UUID REFERENCES `authors` (`id`) ON DELETE CASCADE ON UPDATE CASCADE, UNIQUE (`bookId`, `authorId`));
CREATE TABLE `collections` (`id` UUID PRIMARY KEY, `name` VARCHAR(255), `description` TEXT, `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL, `libraryId` UUID REFERENCES `libraries` (`id`) ON DELETE SET NULL ON UPDATE CASCADE);
CREATE TABLE `collectionBooks` (`id` UUID PRIMARY KEY, `order` INTEGER, `createdAt` DATETIME NOT NULL, `bookId` UUID REFERENCES `books` (`id`) ON DELETE CASCADE ON UPDATE CASCADE, `collectionId` UUID REFERENCES `collections` (`id`) ON DELETE CASCADE ON UPDATE CASCADE, UNIQUE (`bookId`, `collectionId`));
CREATE TABLE `playlists` (`id` UUID PRIMARY KEY, `name` VARCHAR(255), `description` TEXT, `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL, `libraryId` UUID REFERENCES `libraries` (`id`) ON DELETE SET NULL ON UPDATE CASCADE, `userId` UUID REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE);
CREATE TABLE `playlistMediaItems` (`id` UUID PRIMARY KEY, `mediaItemId` UUIDV4, `mediaItemType` VARCHAR(255), `order` INTEGER, `createdAt` DATETIME NOT NULL, `playlistId` UUID REFERENCES `playlists` (`id`) ON DELETE CASCADE ON UPDATE CASCADE);
CREATE TABLE `devices` (`id` UUID PRIMARY KEY, `deviceId` VARCHAR(255), `clientName` VARCHAR(255), `clientVersion` VARCHAR(255), `ipAddress` VARCHAR(255), `deviceName` VARCHAR(255), `deviceVersion` VARCHAR(255), `extraData` JSON, `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL, `userId` UUID REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE);
CREATE TABLE `playbackSessions` (`id` UUID PRIMARY KEY, `mediaItemId` UUIDV4, `mediaItemType` VARCHAR(255), `displayTitle` VARCHAR(255), `displayAuthor` VARCHAR(255), `duration` FLOAT, `playMethod` INTEGER, `mediaPlayer` VARCHAR(255), `startTime` FLOAT, `currentTime` FLOAT, `serverVersion` VARCHAR(255), `coverPath` VARCHAR(255), `timeListening` INTEGER, `mediaMetadata` JSON, `date` VARCHAR(255), `dayOfWeek` VARCHAR(255), `extraData` JSON, `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL, `userId` UUID REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE, `deviceId` UUID REFERENCES `devices` (`id`) ON DELETE SET NULL ON UPDATE CASCADE, `libraryId` UUID REFERENCES `libraries` (`id`) ON DELETE SET NULL ON UPDATE CASCADE);
CREATE TABLE `feeds` (`id` UUID PRIMARY KEY, `slug` VARCHAR(255), `entityType` VARCHAR(255), `entityId` UUIDV4, `entityUpdatedAt` DATETIME, `serverAddress` VARCHAR(255), `feedURL` VARCHAR(255), `imageURL` VARCHAR(255), `siteURL` VARCHAR(255), `title` VARCHAR(255), `description` TEXT, `author` VARCHAR(255), `podcastType` VARCHAR(255), `language` VARCHAR(255), `ownerName` VARCHAR(255), `ownerEmail` VARCHAR(255), `explicit` TINYINT(1), `preventIndexing` TINYINT(1), `coverPath` VARCHAR(255), `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL, `userId` UUID REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE);
CREATE TABLE `feedEpisodes` (`id` UUID PRIMARY KEY, `title` VARCHAR(255), `author` VARCHAR(255), `description` TEXT, `siteURL` VARCHAR(255), `enclosureURL` VARCHAR(255), `enclosureType` VARCHAR(255), `enclosureSize` BIGINT, `pubDate` VARCHAR(255), `season` VARCHAR(255), `episode` VARCHAR(255), `episodeType` VARCHAR(255), `duration` FLOAT, `filePath` VARCHAR(255), `explicit` TINYINT(1), `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL, `feedId` UUID REFERENCES `feeds` (`id`) ON DELETE CASCADE ON UPDATE CASCADE);
CREATE TABLE `settings` (`key` VARCHAR(255) PRIMARY KEY, `value` JSON, `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL);
