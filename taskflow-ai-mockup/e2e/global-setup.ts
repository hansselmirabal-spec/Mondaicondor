import { chromium } from '@playwright/test'

async function globalSetup() {
  const browser = await chromium.launch()
  const page = await browser.newPage()

  await page.goto('http://localhost:5173/login')
  await page.locator('input[type="email"]').fill('tacosta@condor.com.py')
  await page.locator('input[type="password"]').fill('password123')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await page.waitForURL(/boards|workspace/, { timeout: 60_000 })

  // Save auth state for all tests to reuse
  await page.context().storageState({ path: 'e2e/auth.json' })
  await browser.close()
}

export default globalSetup
