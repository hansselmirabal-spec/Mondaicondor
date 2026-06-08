import { Page } from '@playwright/test'

export const WORKSPACE_ID = 'cmpyd787s000612faqzkktf5l'
export const BOARD_ID = 'cmpzw4m9y0024fye2mrg72382'
export const BOARD_URL = `/boards/${BOARD_ID}`

// Each test gets storageState (auth.json) via playwright.config — no login needed per test.
// gotoBoard just navigates and waits for board to be ready.
export async function gotoBoard(page: Page) {
  await page.goto(BOARD_URL)
  await page.waitForSelector('text=tarea 1', { timeout: 20_000 })
}

// loginViaUI is still used by auth tests that need to test the login flow explicitly
export async function loginViaUI(page: Page) {
  // Auth tests start with a fresh context (no storageState) — they test login from scratch
  await page.goto('/login')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await page.waitForURL(/boards|workspace/, { timeout: 60_000 })
}
