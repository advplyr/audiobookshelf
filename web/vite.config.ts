import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The ABS server mounts everything under /audiobookshelf. Proxying keeps the dev app
// same-origin, so the httpOnly refresh_token cookie works without CORS tricks.
// ABS_SERVER comes from the shell or a mode file: `npm run dev:test` uses .env.test
// (the Docker test server in ../../test-server).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const absServer = process.env.ABS_SERVER ?? env.ABS_SERVER ?? 'http://localhost:3333'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        '/audiobookshelf': { target: absServer, changeOrigin: true, ws: true }
      }
    }
  }
})
