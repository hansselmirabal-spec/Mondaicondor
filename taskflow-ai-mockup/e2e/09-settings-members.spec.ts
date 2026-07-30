import { test, expect } from '@playwright/test'

test.describe('Settings — Members', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings/members')
    await expect(page.getByRole('heading', { name: /miembros del workspace/i })).toBeVisible({ timeout: 10_000 })
  })

  test('sidebar shows Config. nav icon', async ({ page }) => {
    await page.goto('/boards')
    const configBtn = page.getByTitle('Config.')
    await expect(configBtn).toBeVisible()
  })

  test('settings nav has Estados, Alertas and Miembros links', async ({ page }) => {
    await expect(page.getByRole('link', { name: /estados/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /alertas por correo/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /miembros/i })).toBeVisible()
  })

  test('workspace switcher is visible', async ({ page }) => {
    await expect(page.locator('select').first()).toBeVisible()
  })

  test('shows current members list', async ({ page }) => {
    const list = page.locator('.divide-y .flex.items-center')
    await expect(list.first()).toBeVisible({ timeout: 8_000 })
    const count = await list.count()
    expect(count).toBeGreaterThan(0)
  })

  test('"Vos" badge appears on current user row', async ({ page }) => {
    await expect(page.getByText('Vos')).toBeVisible({ timeout: 8_000 })
  })

  test('add member section is visible for admin', async ({ page }) => {
    await expect(page.getByText(/agregar miembro/i)).toBeVisible({ timeout: 8_000 })
  })

  test('tab "Usuario registrado" loads user list', async ({ page }) => {
    await page.getByRole('button', { name: /usuario registrado/i }).click()
    // Wait for the user list to load (at least one row with a button)
    const listRows = page.locator('div.border.border-gray-200.rounded-lg button')
    await expect(listRows.first()).toBeVisible({ timeout: 8_000 })
  })

  test('search filters users by name', async ({ page }) => {
    await page.getByRole('button', { name: /usuario registrado/i }).click()
    const searchInput = page.locator('input[placeholder*="Buscar"]')
    await expect(searchInput).toBeVisible({ timeout: 5_000 })

    const totalBefore = await page.locator('div.border.border-gray-200.rounded-lg button').count()
    await searchInput.fill('zzzznotexists')
    await expect(page.getByText(/sin resultados/i)).toBeVisible({ timeout: 3_000 })
    const totalAfter = await page.locator('div.border.border-gray-200.rounded-lg button').count()
    expect(totalAfter).toBeLessThan(totalBefore)
  })

  test('clicking a user selects it and enables add button', async ({ page }) => {
    await page.getByRole('button', { name: /usuario registrado/i }).click()

    // Find a user NOT already a member (not dimmed)
    const availableUser = page.locator('div.border.border-gray-200.rounded-lg button').first()
    await expect(availableUser).toBeVisible({ timeout: 8_000 })
    await availableUser.click()

    const inviteBtn = page.getByRole('button', { name: /agregar a/i })
    await expect(inviteBtn).toBeEnabled({ timeout: 3_000 })
  })

  test('tab "Usuario nuevo" shows direct-add form', async ({ page }) => {
    await page.getByRole('button', { name: /usuario nuevo/i }).click()
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 3_000 })
    await expect(page.locator('select').last()).toBeVisible()
    await expect(page.getByRole('button', { name: /agregar miembro/i })).toBeVisible()
  })

  test('direct-add form requires a valid email', async ({ page }) => {
    await page.getByRole('button', { name: /usuario nuevo/i }).click()
    const submitBtn = page.getByRole('button', { name: /agregar miembro/i })
    await expect(submitBtn).toBeDisabled()
    await page.locator('input[type="email"]').fill('not-an-email')
    await expect(submitBtn).toBeDisabled()
    await page.locator('input[type="email"]').fill('nuevo@empresa.com')
    await expect(submitBtn).toBeEnabled({ timeout: 3_000 })
  })
})
