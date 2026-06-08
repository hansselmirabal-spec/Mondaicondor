import { test, expect } from '@playwright/test'

test.describe('Password reset flow', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('login page has "¿Olvidaste tu contraseña?" link', async ({ page }) => {
    await page.goto('/login')
    const link = page.getByRole('link', { name: /olvidaste/i })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', '/forgot-password')
  })

  test('forgot-password page renders', async ({ page }) => {
    await page.goto('/forgot-password')
    await expect(page.getByRole('heading', { name: /olvidaste/i })).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /enviar/i })).toBeVisible()
  })

  test('forgot-password submit button disabled when email empty', async ({ page }) => {
    await page.goto('/forgot-password')
    await expect(page.getByRole('button', { name: /enviar/i })).toBeDisabled()
  })

  test('forgot-password shows confirmation after submit', async ({ page }) => {
    await page.goto('/forgot-password')
    await page.locator('input[type="email"]').fill('tacosta@condor.com.py')
    await page.getByRole('button', { name: /enviar/i }).click()
    await expect(page.getByText(/revisá tu correo/i)).toBeVisible({ timeout: 10_000 })
  })

  test('forgot-password link goes back to login', async ({ page }) => {
    await page.goto('/forgot-password')
    await page.getByRole('link', { name: /volver/i }).click()
    await expect(page).toHaveURL(/login/, { timeout: 5_000 })
  })

  test('reset-password page shows error without token', async ({ page }) => {
    await page.goto('/reset-password')
    await expect(page.getByText(/link inválido/i)).toBeVisible({ timeout: 5_000 })
  })

  test('reset-password page renders form with valid token param', async ({ page }) => {
    await page.goto('/reset-password?token=fake-token-for-ui-test')
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
    await expect(page.getByRole('button', { name: /actualizar contraseña/i })).toBeVisible()
  })

  test('reset-password validates password length', async ({ page }) => {
    await page.goto('/reset-password?token=fake-token-for-ui-test')
    await page.locator('input[type="password"]').first().fill('short')
    await expect(page.getByText(/al menos 8 caracteres/i)).toBeVisible({ timeout: 3_000 })
  })

  test('reset-password validates passwords match', async ({ page }) => {
    await page.goto('/reset-password?token=fake-token-for-ui-test')
    await page.locator('input[type="password"]').first().fill('password123')
    await page.locator('input[type="password"]').nth(1).fill('different456')
    await expect(page.getByText(/no coinciden/i)).toBeVisible({ timeout: 3_000 })
  })
})
