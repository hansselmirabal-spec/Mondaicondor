import { test, expect } from '@playwright/test'
import { gotoBoard } from './helpers'

test.describe('Task detail drawer', () => {
  test.beforeEach(async ({ page }) => {
    await gotoBoard(page)
    // Open the drawer by clicking the task title
    await page.getByText('tarea 1').first().click()
    await page.waitForURL(/task=/, { timeout: 8_000 })
    // Wait for drawer to be visible
    await expect(page.locator('aside').filter({ hasText: 'tarea 1' })).toBeVisible()
  })

  test('drawer sets task= URL param', async ({ page }) => {
    expect(page.url()).toContain('task=')
  })

  test('drawer shows the task title', async ({ page }) => {
    await expect(page.locator('aside h2', { hasText: 'tarea 1' })).toBeVisible()
  })

  test('drawer shows Responsables section', async ({ page }) => {
    // The Responsables label is inside a button
    await expect(page.locator('aside').getByText(/responsables/i)).toBeVisible()
  })

  test('drawer shows status and priority selects', async ({ page }) => {
    // SelectDropdown renders a button with ChevronDown icon
    const dropdowns = page.locator('aside').locator('button').filter({ has: page.locator('.lucide-chevron-down') })
    await expect(dropdowns.first()).toBeVisible()
  })

  test('assignee picker opens and shows workspace members', async ({ page }) => {
    // Click the Responsables section button (it contains the "Responsables" label text)
    const responsablesBtn = page.locator('aside button', { hasText: /responsables/i }).first()
    await responsablesBtn.click()

    // Picker dropdown opens — members visible anywhere on page (picker is inside aside)
    await expect(page.getByText('Tomás Acosta').first()).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Marcos López').first()).toBeVisible()
    await expect(page.getByText('Julia Contreras').first()).toBeVisible()
    await expect(page.getByText('Sofía Vallejos').first()).toBeVisible()
  })

  test('close button (red X) removes task param from URL', async ({ page }) => {
    // Red X button at top of drawer
    await page.locator('aside button.bg-red-500').click()
    await expect(page).not.toHaveURL(/task=/, { timeout: 5_000 })
  })

  test('Escape key closes drawer', async ({ page }) => {
    await page.keyboard.press('Escape')
    await expect(page).not.toHaveURL(/task=/, { timeout: 5_000 })
  })
})
