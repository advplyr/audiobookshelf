# Changelog — Audiobookshelf web UI

What changed in each version of the new React web UI (`web/`). The fork's server changes that this UI needs are listed
under each version too, so you can see what an update touches on the server.

For the plan behind these versions, see the
[frontend rewrite plan](https://claude.ai/artifact/BaPLYAFKNY1mgTVJThEMqC).

## How versions work

| Version | When it changes | Example |
| --- | --- | --- |
| **0.x.0** | A milestone from the plan is finished | M0 = 0.1.0, M1 (Playback) = 0.2.0 |
| **0.x.y** | Fixes or small additions between milestones | 0.1.1 |
| **1.0.0** | End users switch to the new UI (Gate 1, after M4) | |

Before 1.0.0 the UI is a preview: things can still change without notice.

---

## [0.1.0] — Foundations (Milestone 0)

**Status:** in review, [PR #2](https://github.com/HouseTheFirst/audiobookshelf/pull/2) (stacked on PR #1)

The groundwork every later feature builds on. Little changes on screen; most of it is under the hood.

### Added
- **The server can host the new UI.** Open it at `/audiobookshelf/web/` on any server where it's turned on. Phones and
  other computers no longer need the developer setup.
- **Consistent look and feel.** Shared buttons, form fields, dialogs, dropdown menus and pop-up messages across every page.
- **Pop-up confirmations** when you add, mark or remove wishlist items.
- **Wishlist actions menu** on each book (mark acquired, move back to wanted, remove), and "Add book" opens in a dialog.
- **Icons** in the sidebar and on buttons.
- **Error screen** instead of a blank page when something fails, with a "Try again" button.
- **Admin shortcut:** admins see a "Server settings" link to the existing settings pages (admin stays there until
  Milestone 5).
- **Permissions respected:** you only see libraries you have access to, and changes an admin makes to your account
  apply right away.

### Changed
- Live updates (new books, library changes, wishlist changes from another device) are now handled in one place, so
  every page stays current the same way.
- Themes gained a "success" color, used for confirmations. Custom themes can set it too.

### Fixed
- Screen readers read the Wishlist tabs as "acquired" instead of "Acquired".
- The app failed to build inside Docker (a missing development dependency).

### Server changes
- New, off by default: setting `WEB_CLIENT_PATH` makes the server serve this UI at `/audiobookshelf/web/`.
  Nothing else changes when it isn't set.
- The Docker image now includes the built UI at `/app/web/dist`.

### Testing
- 18 automated unit tests and 6 browser tests (run at desktop and phone size) now check sign-in, the library, themes,
  the wishlist and permissions on every change.

---

## [0.0.1] — First preview

**Status:** in review, [PR #1](https://github.com/HouseTheFirst/audiobookshelf/pull/1)

The first working version of the new web UI, running alongside the existing one.

### Added
- **Sign in** with your existing Audiobookshelf account. You stay signed in: expired sessions renew automatically.
- **Library view:** your books as a cover grid, sortable by recently added, title or author, 48 per page.
- **Live updates:** books added or changed on the server appear without reloading.
- **Themes:** Light, Dark, Midnight and Sepia, or follow your device's light/dark setting.
- **Custom themes:** pick your own colors and corner style, starting from any built-in theme. Saved on this device.
- **Wishlist:** keep a list of books you want, with author, series, link, cover and notes. Mark them as acquired when
  you get them. Your list is private to your account and stays in sync across your devices.
- Works at phone width.

### Server changes
- New wishlist storage and API (`/api/wishlist`), private to each user. Added automatically on startup; no migration.
- Nothing existing was renamed or changed, so the mobile app and Absorb keep working as before.
