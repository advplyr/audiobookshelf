import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

/**
 * Browser tests against the Docker test server (../../test-server), which serves the built app
 * at /audiobookshelf/web/. reset.ps1 creates the non-admin "e2e" user and keeps its password in
 * test-server/.env; E2E_BASE_URL / E2E_PASSWORD env vars override.
 */
function testServerEnv(key: string) {
  try {
    const envFile = fileURLToPath(new URL('../../test-server/.env', import.meta.url))
    return readFileSync(envFile, 'utf8').match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]?.trim()
  } catch {
    return undefined
  }
}

const port = testServerEnv('TEST_PORT') ?? '13379'
process.env.E2E_PASSWORD ??= testServerEnv('E2E_PASSWORD')

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // tests share one server and one user
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${port}/audiobookshelf/web/`,
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } }
  ]
})
