# web — custom Audiobookshelf frontend

Standalone React + Vite + TypeScript + Tailwind client for the Audiobookshelf server in this repo.
It talks only to the existing server API and socket.io, so the official mobile app and other clients are unaffected.

## Dev

1. Start the server from the repo root: `npm run dev` (port 3333, base path `/audiobookshelf`).
2. Start this app: `cd web && npm install && npm run dev` → http://localhost:5173

Vite proxies `/audiobookshelf/*` (including the socket) to `ABS_SERVER` (default `http://localhost:3333`), so the app is
same-origin in dev and the httpOnly refresh-token cookie just works.

## Layout

- `src/api/` — fetch wrapper (Bearer token + automatic `/auth/refresh` on 401), socket.io client, response types
- `src/auth/` — login/session restore (`/login`, `/api/authorize`, `/logout`)
- `src/theme/` + `src/index.css` — theme tokens; builtin themes plus user custom themes (stored in localStorage)
- `src/sections.tsx` — sidebar sections registry; add a feature by adding an entry
- `src/pages/` — Login, Library, Wishlist, Settings

## Server additions used by this app

- `/api/wishlist` (GET, POST, PATCH `/:id`, DELETE `/:id`), per-user — `server/controllers/WishlistController.js`
- socket events `wishlist_item_added|updated|removed`, sent only to the owning user
