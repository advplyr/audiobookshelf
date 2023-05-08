import { defineNitroPreset } from 'nitropack'
import { fileURLToPath } from 'node:url'

export default defineNitroPreset({
  extends: 'node-server',
  entry: fileURLToPath(new URL('./nitro.entry.js', import.meta.url)),
})
