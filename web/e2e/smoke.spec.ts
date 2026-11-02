import { expect, test, type Page } from '@playwright/test'

// Runs against the test server's prod copy, signed in as the test-only non-admin "e2e" user.
const USER = 'e2e'
const PASSWORD = process.env.E2E_PASSWORD ?? ''

test.skip(!PASSWORD, 'E2E_PASSWORD missing: run test-server/reset.ps1 first')

async function signIn(page: Page) {
  await page.goto('./')
  await page.getByLabel('Username').fill(USER)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
}

/** On a phone the sidebar sits above the page; links are the same. */
const nav = (page: Page) => page.getByRole('navigation', { name: 'Main' })

test('wrong password shows an error and stays on login', async ({ page }) => {
  await page.goto('./')
  await page.getByLabel('Username').fill(USER)
  await page.getByLabel('Password').fill('definitely-wrong')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText('Invalid username or password')).toBeVisible()
})

test('signs in and shows the library with covers', async ({ page }) => {
  await signIn(page)
  await expect(page).toHaveURL(/\/library\//)
  await expect(page.getByText(/^\d+ items$/)).toBeVisible()
  const firstCover = page.locator('main img').first()
  await expect(firstCover).toBeVisible()
  await expect.poll(() => firstCover.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
})

test('non-admins do not see the admin link', async ({ page }) => {
  await signIn(page)
  await expect(nav(page).getByRole('link', { name: 'Server settings' })).toHaveCount(0)
})

test('deep links survive a reload and the session is restored', async ({ page }) => {
  await signIn(page)
  await nav(page).getByRole('link', { name: 'Wishlist' }).click()
  await expect(page).toHaveURL(/\/web\/wishlist$/)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Wishlist' })).toBeVisible()
})

test('theme choice applies and persists', async ({ page }) => {
  await signIn(page)
  await nav(page).getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('radio', { name: 'Sepia' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sepia')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sepia')
})

test('wishlist: add, mark acquired and remove, with toasts', async ({ page }, testInfo) => {
  const title = `E2E book ${testInfo.project.name} ${Date.now()}`
  await signIn(page)
  await nav(page).getByRole('link', { name: 'Wishlist' }).click()

  await page.getByRole('button', { name: 'Add book' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add to wishlist' })
  await dialog.getByLabel('Title *').fill(title)
  await dialog.getByLabel('Author').fill('Playwright')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('status').filter({ hasText: `Added "${title}"` })).toBeVisible()

  const row = page.getByRole('listitem').filter({ hasText: title })
  await row.getByRole('button', { name: `Actions for ${title}` }).click()
  await page.getByRole('menuitem', { name: 'Mark acquired' }).click()
  await expect(row).toBeHidden()

  await page.getByRole('tab', { name: /Acquired/ }).click()
  await row.getByRole('button', { name: `Actions for ${title}` }).click()
  await page.getByRole('menuitem', { name: 'Remove' }).click()
  await expect(row).toBeHidden()
})
