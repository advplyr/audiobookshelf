# Security Policy

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Report security issues to the Audiobookshelf maintainers using [GitHub Security Advisories](https://github.com/advplyr/audiobookshelf/security/advisories/new):

1. Open a **private** security advisory on [advplyr/audiobookshelf](https://github.com/advplyr/audiobookshelf/security/advisories).
2. Include a clear description, impact assessment, and reproduction steps.
3. Allow reasonable time for a fix before public disclosure.

If you cannot use GitHub Security Advisories, contact the maintainers via the [Audiobookshelf Discord](https://discord.gg/HQgCbd6E75) and ask for a private security contact.

## Supported Versions

Security fixes are applied to the latest release on the `master` branch. Upgrade to the newest version when a security patch is published.

## Recently Addressed Issue (pending upstream advisory)

**Root user delete authorization bypass (CWE-863)**

- **Issue:** `DELETE /api/users/:id` compared `req.params.id` to the literal string `"root"` instead of checking the target user's `type === 'root'`. Because root's primary key is a UUID, any `admin` account could delete the superuser.
- **Fix:** `UserController.delete()` now mirrors `update()` with `req.reqUser.isRoot` checks; `User` model `beforeDestroy` hook blocks direct root deletion.
- **Tests:** `test/server/controllers/UserController.test.js`
- **Action for maintainers:** Publish a GitHub Security Advisory and release containing this fix.
