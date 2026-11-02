import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The ABS server mounts everything under /audiobookshelf. Proxying keeps the dev app
// same-origin, so the httpOnly refresh_token cookie works without CORS tricks.
const ABS_SERVER = process.env.ABS_SERVER ?? 'http://localhost:3333'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/audiobookshelf': { target: ABS_SERVER, changeOrigin: true, ws: true }
    }
  }
})
