# web — custom Audiobookshelf frontend

Standalone React + Vite + TypeScript + Tailwind client for the Audiobookshelf server in this repo.
It talks only to the existing server API and socket.io, so the official mobile app and other clients are unaffected.

## Dev

1. Start the server from the repo root: `npm run dev` (port 3333, base path `/audiobookshelf`).
2. Start this app: `cd web && npm install && npm run dev` → http://localhost:5173

Vite proxies `/audiobookshelf/*` (including the socket) to `ABS_SERVER` (default `http://localhost:3333`), so the app is
same-origin in dev and the httpOnly refresh-token cookie just works.

`npm run dev:test` runs on http://localhost:5174 against the Docker test server (`ABS_SERVER` from `.env.test`,
`http://localhost:13379`). A shell `ABS_SERVER` overrides either.

## Served by the server

`npm run build` outputs `dist/` for the base path `/audiobookshelf/web/`. The server serves it there only when
`WEB_CLIENT_PATH` points at that folder (`WebClientPath` in `dev.js`); otherwise the stock UI is untouched.
The Docker image builds it into `/app/web/dist`, so set `WEB_CLIENT_PATH=/app/web/dist` to turn it on.

## Tests

- `npm test` — Vitest unit tests (`src/**/*.test.ts(x)`), jsdom, no server needed
- `npm run test:e2e` — Playwright against the Docker test server's `/audiobookshelf/web/`, desktop and phone viewports,
  signed in as the test-only non-admin `e2e` user that `test-server/reset.ps1` creates (password in `test-server/.env`).
  Run `reset.ps1` first; it also gives every run the same data. First time: `npx playwright install chromium`.

## Layout

- `src/api/` — fetch wrapper (Bearer token + automatic `/auth/refresh` on 401), socket.io client, response types,
  `queryKeys.ts` (every React Query key), `socketBridge.ts` (server socket events → which cached data to refresh)
- `src/auth/` — login/session restore (`/login`, `/api/authorize`, `/logout`), `permissions.ts` (mirrors the server's checks)
- `src/components/ui/` — shared kit: Button/IconButton, Field + Input/TextArea/Select, Modal, Menu, toasts, ErrorBoundary
- `src/theme/` + `src/index.css` — theme tokens; builtin themes plus user custom themes (stored in localStorage)
- `src/sections.tsx` — sidebar sections registry; add a feature by adding an entry (`adminOnly` to hide from non-admins)
- `src/pages/` — Login, Library, Wishlist, Settings

Pages don't subscribe to the socket themselves: they use queries keyed from `queryKeys.ts`, and `socketBridge.ts`
invalidates those keys when the server reports changes.

## Server additions used by this app

- `/api/wishlist` (GET, POST, PATCH `/:id`, DELETE `/:id`), per-user — `server/controllers/WishlistController.js`
- socket events `wishlist_item_added|updated|removed`, sent only to the owning user
- `WEB_CLIENT_PATH` → serves this app at `/audiobookshelf/web/` — `server/utils/webClient.js`
