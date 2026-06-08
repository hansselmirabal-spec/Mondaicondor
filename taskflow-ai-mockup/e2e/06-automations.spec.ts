import { test, expect } from '@playwright/test'
import { gotoBoard } from './helpers'

const MODAL_TITLE = 'Nueva automatización'

test.describe('Automations panel', () => {
  test.beforeEach(async ({ page }) => {
    await gotoBoard(page)
    await page.getByRole('button', { name: 'Automatizar', exact: true }).click()
    await expect(page.locator('aside h2', { hasText: 'Automatizaciones' })).toBeVisible({ timeout: 5_000 })
  })

  test('Automatizar button opens panel and sets URL', async ({ page }) => {
    expect(page.url()).toContain('panel=automations')
  })

  test('panel has Nueva automatización button', async ({ page }) => {
    await expect(page.locator('aside').getByText(/nueva automatización/i)).toBeVisible()
  })

  test('Nueva automatización opens the creation modal', async ({ page }) => {
    await page.locator('aside').getByText(/nueva automatización/i).click()
    await expect(page.locator('h2', { hasText: MODAL_TITLE })).toBeVisible()
    await expect(page.locator('input').first()).toBeVisible()
  })

  test('trigger select has human-readable options starting with "Cuando"', async ({ page }) => {
    await page.locator('aside').getByText(/nueva automatización/i).click()
    await expect(page.locator('h2', { hasText: MODAL_TITLE })).toBeVisible()
    const options = await page.locator('select').nth(0).locator('option').allTextContents()
    expect(options.some(o => o.includes('Cuando'))).toBeTruthy()
  })

  test('creates automation and it appears in the list', async ({ page }) => {
    await page.locator('aside').getByText(/nueva automatización/i).click()
    await expect(page.locator('h2', { hasText: MODAL_TITLE })).toBeVisible()

    await page.locator('input').first().fill('QA Auto Test')
    await page.locator('select').nth(0).selectOption('task.completed')
    await page.locator('select').nth(1).selectOption('set_priority')
    await expect(page.locator('select').nth(2)).toBeVisible({ timeout: 3_000 })
    await page.locator('select').nth(2).selectOption('Alta')
    await page.getByRole('button', { name: /guardar/i }).click()

    await expect(page.locator('aside').getByText('QA Auto Test')).toBeVisible({ timeout: 10_000 })
  })

  test('automation card shows trigger (blue) and action (green) sections', async ({ page }) => {
    const autoCard = page.locator('aside .bg-white.rounded-xl', { hasText: 'QA Auto Test' }).first()
    if (await autoCard.count() === 0) { test.skip(); return }
    await expect(autoCard.locator('.bg-blue-50')).toBeVisible()
    await expect(autoCard.locator('.bg-green-50')).toBeVisible()
  })

  test('can toggle automation enabled/disabled', async ({ page }) => {
    const autoCard = page.locator('aside .bg-white.rounded-xl', { hasText: 'QA Auto Test' }).first()
    if (await autoCard.count() === 0) { test.skip(); return }
    const toggleBtn = autoCard.locator('button').last()
    const svgBefore = await toggleBtn.locator('svg').getAttribute('class')
    await toggleBtn.click()
    await page.waitForTimeout(600)
    const svgAfter = await toggleBtn.locator('svg').getAttribute('class')
    expect(svgAfter).not.toBe(svgBefore)
  })

  test('can delete automation', async ({ page }) => {
    const autoCard = page.locator('aside .bg-white.rounded-xl', { hasText: 'QA Auto Test' }).first()
    if (await autoCard.count() === 0) { test.skip(); return }
    await autoCard.locator('button').nth(0).click()
    await expect(page.locator('aside .bg-white.rounded-xl', { hasText: 'QA Auto Test' })).not.toBeVisible({ timeout: 5_000 })
  })

  test('X button closes panel', async ({ page }) => {
    await page.locator('aside').getByRole('button').first().click()
    await expect(page).not.toHaveURL(/panel=/, { timeout: 5_000 })
  })

  test('Escape closes panel', async ({ page }) => {
    await page.keyboard.press('Escape')
    await expect(page).not.toHaveURL(/panel=/, { timeout: 5_000 })
  })
})
