import { test, expect } from '@playwright/test'
import { loginViaUI, BOARD_URL } from './helpers'

test.describe('Auth', () => {
  // Auth tests must start without pre-loaded auth state to test login flow
  test.use({ storageState: { cookies: [], origins: [] } })
  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Bienvenido de nuevo' })).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible()
  })

  test('login with valid credentials redirects to boards', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="email"]').fill('tacosta@condor.com.py')
    await page.locator('input[type="password"]').fill('password123')
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await page.waitForURL(/boards|workspace/, { timeout: 15_000 })
    expect(page.url()).toMatch(/boards|workspace/)
  })

  test('login with wrong credentials shows error', async ({ page }) => {
    await page.goto('/login')
    // pressSequentially fires React onChange on every keystroke (fill() bypasses it for controlled inputs)
    await page.locator('input[type="email"]').selectText()
    await page.locator('input[type="email"]').pressSequentially('fake@test.com')
    await page.locator('input[type="password"]').selectText()
    await page.locator('input[type="password"]').pressSequentially('badpass')
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page.locator('.bg-red-50')).toBeVisible({ timeout: 15_000 })
  })

  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto(BOARD_URL)
    await page.waitForURL(/login/, { timeout: 8_000 })
    expect(page.url()).toContain('login')
  })

  test('after login user can access board directly', async ({ page }) => {
    await loginViaUI(page)
    await page.goto(BOARD_URL)
    await page.waitForSelector('text=tarea 1', { timeout: 15_000 })
    expect(page.url()).not.toContain('login')
  })
})
