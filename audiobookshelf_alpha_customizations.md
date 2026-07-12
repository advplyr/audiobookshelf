# Audiobookshelf Alpha Build (v2.33.0-aw) Customizations

This file documents the custom modifications made to the local audiobookshelf repository.

## Applied Pull Requests
1. **PR #5073:** Query Performance - Optimizes API cache and Discover query performance. Includes database indexes.
2. **PR #5046:** Rating & Reviews System - Introduces a comprehensive 1-5 star rating and review system for all library items, including an admin moderation page.
3. **PR #5064:** Series Total Duration - Adds the total duration and your total listened time to the top of Series pages, great for tracking long sagas.
4. **PR #5078:** Server-Side Comics - Extracts and caches comic pages on the server instead of the browser, significantly speeding up large comics.
5. **PR #5080:** MediaSession Chapters - Makes the OS-level media scrubber (lock screen) respect chapter boundaries when 'Use chapter track' is enabled.
6. **PR #5006:** Fix Chapter Merging - Fixes a bug where fetching new chapters from Audible doesn't fully overwrite your old chapter list if the new list is shorter.
7. **PR #4988:** Better Cover Extraction - Improves the built-in cover extractor to ignore 1x1 pixel placeholders and always extract the highest resolution cover art embedded in the file.
8. **PR #5036:** Subtitle Parsing Fix - Fixes a bug where titles with a colon (:) were sometimes failing to be correctly split into Title and Subtitle during a scan.
9. **PR #5092:** Auto-Skip Intros/Outros - Adds a feature to automatically skip chapter intros and outros during playback.
10. **PR #5104:** Per-Book Playback Speed - Allows saving and resuming different playback speeds for individual library items instead of a global default.
11. **PR #5089:** Password Manager Support - Adds proper autocomplete HTML attributes to login fields so password managers can easily save and autofill credentials.
12. **PR #5065:** Adjustable Cover Preview Sizing - Adds zoom-in/zoom-out buttons when searching for Cover Art to easily view high-resolution details.
13. **PR #5063:** IDOR Security Fixes - Patches API vulnerabilities preventing unauthorized manipulation of bookmarks, media progress, and listening sessions.
14. **PR #4935:** Natural Volume Scaling - Adds a user setting for logarithmic volume scaling, making the volume slider feel more natural.
15. **PR #4959:** Standardized Embedded Tags - When embedding metadata into MP4/M4B files, Audiobookshelf now strictly conforms to Mp3tag and Plex standards for maximum external compatibility.
16. **PR #4797:** Auto-Match After Scan - Adds an option to automatically trigger a Quick Match with metadata providers immediately after a scheduled folder scan completes.
17. **PR #4925:** Import .CUE Chapters - Adds a button to the Chapter Editor to easily import chapter timestamps and titles directly from standard `.cue` files.
18. **PR #4970:** Share Page Visibility Fix - Ensures the download icon on shared book pages remains visible when the cover art has a white background.
19. **PR #4774:** HTTP Response Compression - Enables Gzip compression for all server traffic, making the interface snappier over remote connections.
20. **PR #4962:** Rename Series Directly - Adds the ability to rename an entire series directly from the UI with duplicate validation.
21. **PR #5076:** Author Name Auto-Update - Automatically corrects the Author name in the database when matching a book to a corrected metadata entry.
22. **PR #4976:** Case-Insensitive Matching - Prevents duplicate authors/series creation during import caused by capitalization differences.
23. **PR #4807:** Hide/Unhide Series - Adds a feature to hide specific series from library shelves without deleting the files.
24. **PR #4782:** Smarter Toast Placement - Prevents toast notifications from overlapping with the media player bar at the bottom of the screen.
25. **PR #5045:** Upload to Existing Folders - Allows adding new files to a book's folder without deleting and re-uploading everything.
26. **PR #4788:** Reliable Metadata Search - Increases search timeout to 120s to handle slow or throttled metadata providers.
27. **PR #5015:** Log Purge Bugfix - Centralizes and improves automated purging of daily and scanner logs.
28. **PR #4938:** Series "Started" Filter - Adds a filter to the Series page to find series you've begun but not finished.
29. **PR #4828:** Narrator Sorting - Adds interactive sorting by name and book count to the Narrators page.
30. **PR #4907:** Better Playlist Controls - Adds buttons to quickly move items to the top or bottom of a playlist.
31. **PR #4748:** MusicBrainz Provider - Adds MusicBrainz as a new metadata and cover art provider.
32. **PR #4409:** Podcast Release Calendar - Adds a new Calendar page to visualize podcast episode release dates.
33. **PR #3334:** Sync Audiobook to E-book - Adds a button to the player to open the companion EPUB file to the current chapter.
34. **PR #4857:** Robust Metadata ID Matching - Stores ABS IDs in `metadata.json` to prevent data loss when moving files.
35. **PR #4681:** Read Embedded Tags - Adds support for reading embedded "tags" metadata from audio file ID3 tags.
36. **PR #4594:** Podcast Metadata Embedding - Allows writing metadata changes back to podcast audio files.
37. **PR #2464:** "Play Next" in Queue - Adds buttons to book cards and podcast episodes to instantly insert an item at the top of the playback queue.
38. **Internal Fix:** Case-Insensitive Author/Series Scanner - Fixes a server crash (UniqueConstraintError) during library rescans when folder metadata differs in capitalization from the database.
39. **PR #5004:** Token Refresh Grace Period - Fixes login race conditions on mobile/watch apps by adding a 1-minute grace period for token rotation.
40. **PR #5084:** Bcrypt Cost Config - Increases default password security to modern standards and adds a configurable hashing cost.
41. **PR #4978:** Podcast Continue Series - Adds the "Continue Series" shelf to podcasts, finding the correct next episode for both serial and episodic shows.
42. **PR #4331:** Custom Podcast Filenames - Allows users to define filename templates for downloaded podcast episodes.
43. **PR #5056:** Precise Log Timestamps - Adds minutes, seconds, and milliseconds to log filenames for easier debugging.

## Custom Features Developed

### 1. Folder Structure Genre Extraction
*   **Modified File:** `server/utils/scandir.js`
*   **Description:** Modified `getBookDataFromDir` to extract a 4th-level directory as the `genre`. When scanning a folder structured like `Genre/Author/Series/Title/`, the scanner now successfully applies the Genre.
*   **Modified File:** `server/scanner/LibraryItemScanData.js`
*   **Description:** Updated `setBookMetadataFromFilenames` to apply the parsed genre directly to the book metadata during the scan.

### 2. Auto-Tagging Keyword Engine
*   **New File:** `server/utils/metadata/autoTagger.js`
*   **Description:** Created an intelligent keyword-matching engine. It maps broad categories (e.g., Cybersecurity, Philosophy, Sci-Fi) to arrays of specific keywords. It scans the book's Title, Subtitle, Description, and existing tags/genres using strict regex boundaries and generates relevant tags.
*   **Modified File:** `server/controllers/LibraryItemController.js`
*   **Description:** Added an `autoTag` API endpoint (`POST /api/items/:id/auto-tag`) that utilizes the `autoTagger.js` engine to append the generated tags to the book and save them to the database.
*   **Modified File:** `server/routers/ApiRouter.js`
*   **Description:** Registered the new `/items/:id/auto-tag` route.

### 3. Frontend Auto-Tag Button
*   **Modified File:** `client/components/modals/item/tabs/Details.vue`
*   **Description:** Added an "Auto Tag" button next to "Quick Match" and "Re-Scan" in the Edit -> Details tab. The button triggers the backend `autoTag` endpoint and displays a toast notification upon success.

### 4. Custom Version & Changelog
*   **Modified Files:** `package.json`, `client/package.json`
*   **Description:** Updated version to `2.33.0-aw` to ensure all custom migrations are triggered.
*   **Modified File:** `client/plugins/version.js`
*   **Description:** Intercepted the GitHub release check in `checkForUpdate`. Injected a custom alpha release object for `v2.33.0-aw` containing detailed markdown release notes, ensuring the UI changelog modal renders correctly instead of blank.

### 5. Database Migration Fix (Podcast Filename Format)
*   **Modified Files:** `server/migrations/`
*   **Description:** Renamed several PR-introduced migrations (like the podcast filename format migration) to `v2.33.0` to ensure they are properly executed by the MigrationManager, fixing the "no such column" database errors.

### 6. Public Share Page UX Overhaul
*   **Modified File:** `client/pages/share/_slug.vue`
*   **Description:** Improved the mobile/iPad experience for shared items. Added a prominent Play button overlay on the cover art and made the entire cover image clickable to toggle play/pause.

### 7. Home Page Shelf Resilience
*   **Modified File:** `server/models/LibraryItem.js`
*   **Description:** Added advanced error handling and logging to the personalized shelf loading logic. If one shelf (e.g., "Discover") fails due to a complex query, the rest of the home page will now still load correctly, and detailed diagnostic logs are provided.

### 8. "The Bay" Discovery Hub (Phase 1)
*   **New File:** `client/pages/library/_library/bay.vue`
*   **Modified Files:** `server/controllers/LibraryController.js`, `server/routers/ApiRouter.js`, `client/components/app/SideRail.vue`, `client/components/app/BookShelfToolbar.vue`
*   **Description:** Added a new discovery hub called "The Bay" to the library sidebar. Phase 1 implements the UI scaffolding, navigation, and basic category filtering. The backend provides a list of common categories from Audible/Audiobooks.com.

## Build and Deployment Details
*   **Docker Image:** The image is built specifically for `linux/amd64` using `docker buildx` to ensure compatibility with the remote VM.
*   **Image Name:** `audiobookshelf:v2.33.0-aw`
*   **Deployment:** Pushed directly to `app@10.0.1.123`.
