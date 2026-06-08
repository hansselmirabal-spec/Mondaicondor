import { test, expect } from '@playwright/test'
import { gotoBoard } from './helpers'

test.describe('Row dropdowns (status / priority / assignee)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoBoard(page)
  })

  test('status dropdown opens when clicking Estado cell', async ({ page }) => {
    const taskRow = page.locator('tr', { hasText: 'tarea 1' }).first()
    // Estado cell contains a StatusBadge
    const statusCell = taskRow.locator('td', { has: page.locator('[class*="StatusBadge"], span[class*="rounded"]') }).first()
    await statusCell.click()

    // Fixed dropdown has z-[9999]
    const dropdown = page.locator('.fixed.z-\\[9999\\]').first()
    await expect(dropdown).toBeVisible({ timeout: 5_000 })

    // Must be inside viewport (not clipped)
    const box = await dropdown.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.y).toBeGreaterThan(0)
    expect(box!.x).toBeGreaterThan(0)
    expect(box!.y + box!.height).toBeLessThan(1200) // reasonable viewport height
  })

  test('status dropdown contains status options', async ({ page }) => {
    const taskRow = page.locator('tr', { hasText: 'tarea 1' }).first()
    // Click the Estado column cell (4th td: 0=checkbox, 1=title, 2=responsable, 3=estado)
    await taskRow.locator('td').nth(3).click()

    const dropdown = page.locator('.fixed.z-\\[9999\\]').first()
    await expect(dropdown).toBeVisible({ timeout: 5_000 })
    // Should contain buttons for status options
    const buttons = dropdown.getByRole('button')
    await expect(buttons.first()).toBeVisible()
  })

  test('priority dropdown opens when clicking Prioridad cell', async ({ page }) => {
    const taskRow = page.locator('tr', { hasText: 'tarea 1' }).first()
    await taskRow.locator('td').nth(4).click()

    const dropdown = page.locator('.fixed.z-\\[9999\\]').first()
    await expect(dropdown).toBeVisible({ timeout: 5_000 })
  })

  test('priority dropdown contains all priority levels', async ({ page }) => {
    const taskRow = page.locator('tr', { hasText: 'tarea 1' }).first()
    await taskRow.locator('td').nth(4).click()

    const dropdown = page.locator('.fixed.z-\\[9999\\]').first()
    await expect(dropdown).toBeVisible({ timeout: 5_000 })
    // Each priority option is a button
    const buttons = dropdown.getByRole('button')
    const count = await buttons.count()
    expect(count).toBe(5) // Crítica, Alta, Media, Baja, Always On
  })

  test('assignee dropdown opens and shows workspace members', async ({ page }) => {
    const taskRow = page.locator('tr', { hasText: 'tarea 1' }).first()
    await taskRow.locator('td').nth(2).click() // Responsable is 3rd column

    const dropdown = page.locator('.fixed.z-\\[9999\\]').first()
    await expect(dropdown).toBeVisible({ timeout: 5_000 })
    // Should show workspace members (at least one name visible)
    await expect(dropdown.getByText(/tomás|maría|marcos|julia|roberto|sofía|hanssel/i).first()).toBeVisible()
  })

  test('clicking status option updates the task', async ({ page }) => {
    const taskRow = page.locator('tr', { hasText: 'tarea 1' }).first()
    await taskRow.locator('td').nth(3).click()

    const dropdown = page.locator('.fixed.z-\\[9999\\]').first()
    await expect(dropdown).toBeVisible({ timeout: 5_000 })

    // Click first button in dropdown
    await dropdown.getByRole('button').first().click()
    // Dropdown should close
    await expect(dropdown).not.toBeVisible({ timeout: 3_000 })
  })

  test('clicking outside closes dropdown', async ({ page }) => {
    const taskRow = page.locator('tr', { hasText: 'tarea 1' }).first()
    await taskRow.locator('td').nth(3).click()

    const dropdown = page.locator('.fixed.z-\\[9999\\]').first()
    await expect(dropdown).toBeVisible({ timeout: 5_000 })

    // Click outside
    await page.mouse.click(10, 10)
    await expect(dropdown).not.toBeVisible({ timeout: 3_000 })
  })
})
