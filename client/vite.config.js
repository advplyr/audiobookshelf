import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue2'
import path from 'path'
// Minimal Vite config for Cypress component testing
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname)
    }
  }
})
