import { test, expect } from '@playwright/test'

// NOTE: these specs require the logged-in fixture user to be a system admin
// (User.isAppAdmin === true). The default e2e login user, tacosta@condor.com.py,
// is NOT seeded with isAppAdmin: true (confirmed in
// taskflow-ai-backend/src/db/seed.ts — no isAppAdmin flag is set there).
// TODO: seed a dedicated isAppAdmin fixture user (or flip tacosta's flag in a
// test-only seed) and swap the login credentials below before un-skipping.
const LOGGED_IN_USER_IS_APP_ADMIN = false

test.describe('System Admin', () => {
  test.skip(!LOGGED_IN_USER_IS_APP_ADMIN, 'Fixture user is not isAppAdmin — see TODO above')

  test('only an app admin sees the Admin nav icon and can reach /system-admin/users', async ({ page }) => {
    await page.goto('/boards')
    const adminBtn = page.getByTitle('Admin')
    await expect(adminBtn).toBeVisible()
    await adminBtn.click()
    await expect(page).toHaveURL(/system-admin\/users/, { timeout: 10_000 })
    await expect(page.getByRole('heading', { name: /administración del sistema/i })).toBeVisible()
  })

  test('reset password reveals a temp password exactly once', async ({ page }) => {
    await page.goto('/system-admin/users')
    await expect(page.getByRole('heading', { name: /administración del sistema/i })).toBeVisible({ timeout: 10_000 })

    const row = page.locator('tbody tr').first()
    await row.hover()
    await row.getByTitle('Resetear contraseña').click()

    await expect(page.getByRole('heading', { name: /resetear contraseña/i })).toBeVisible()
    await page.getByRole('button', { name: /^resetear contraseña$/i }).click()

    const tempPasswordCode = page.locator('code')
    await expect(tempPasswordCode).toBeVisible({ timeout: 10_000 })
    const tempPassword = await tempPasswordCode.textContent()
    expect(tempPassword?.length).toBeGreaterThan(0)

    // Dismiss and reopen — the temp password must not be shown again (reveal-once)
    await page.getByRole('button', { name: /^listo$/i }).click()
    await row.hover()
    await row.getByTitle('Resetear contraseña').click()
    await expect(page.getByRole('heading', { name: /resetear contraseña/i })).toBeVisible()
    await expect(page.locator('code')).not.toBeVisible()
  })

  test('self-reset shows an amber warning but is not blocked', async ({ page }) => {
    await page.goto('/system-admin/users')
    await expect(page.getByRole('heading', { name: /administración del sistema/i })).toBeVisible({ timeout: 10_000 })

    // NOTE: assumes the logged-in fixture user's own row is present in the table.
    const selfRow = page.locator('tbody tr', { hasText: 'tacosta@condor.com.py' })
    await selfRow.hover()
    await selfRow.getByTitle('Resetear contraseña').click()

    await expect(page.getByText(/estás restableciendo tu propia contraseña/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /^resetear contraseña$/i })).toBeEnabled()
  })

  test('edit modal no longer has a password field', async ({ page }) => {
    await page.goto('/system-admin/users')
    await expect(page.getByRole('heading', { name: /administración del sistema/i })).toBeVisible({ timeout: 10_000 })

    const row = page.locator('tbody tr').first()
    await row.hover()
    await row.getByTitle('Editar').click()

    await expect(page.getByRole('heading', { name: /editar usuario/i })).toBeVisible()
    await expect(page.locator('input[type="password"]')).toHaveCount(0)
  })
})
