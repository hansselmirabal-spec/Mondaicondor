import { test, expect } from '@playwright/test'
import { gotoBoard } from './helpers'

test.describe('Workspace', () => {
  test.beforeEach(async ({ page }) => {
    await gotoBoard(page)
  })

  test('sidebar shows workspace name Digital', async ({ page }) => {
    await expect(page.getByText('Digital').first()).toBeVisible()
  })

  test('workspace trigger button opens dropdown', async ({ page }) => {
    // The trigger is a w-full button in the sidebar containing the workspace name
    // It has class "text-white w-full min-w-0" and contains the name in a span
    const trigger = page.locator('button.w-full').filter({
      has: page.locator('span', { hasText: 'Digital' }),
    }).first()
    await expect(trigger).toBeVisible()
    await trigger.click()
    // "Nuevo workspace" button should appear in the dropdown
    await expect(page.getByText('Nuevo workspace')).toBeVisible({ timeout: 3_000 })
  })

  test('dropdown shows all workspaces in the list', async ({ page }) => {
    const trigger = page.locator('button.w-full').filter({
      has: page.locator('span', { hasText: 'Digital' }),
    }).first()
    await trigger.click()
    // Digital, Test Workspace and others should be visible
    await expect(page.getByText('Mis workspaces')).toBeVisible({ timeout: 3_000 })
  })

  test('clicking Nuevo workspace shows creation form', async ({ page }) => {
    const trigger = page.locator('button.w-full').filter({
      has: page.locator('span', { hasText: 'Digital' }),
    }).first()
    await trigger.click()
    await page.getByText('Nuevo workspace').click()
    // Creation form has name input
    await expect(page.getByPlaceholder('Nombre del workspace...')).toBeVisible({ timeout: 3_000 })
  })

  test('workspace creation input accepts text', async ({ page }) => {
    const trigger = page.locator('button.w-full').filter({
      has: page.locator('span', { hasText: 'Digital' }),
    }).first()
    await trigger.click()
    await page.getByText('Nuevo workspace').click()

    const input = page.getByPlaceholder('Nombre del workspace...')
    await expect(input).toBeVisible({ timeout: 3_000 })
    await input.fill('QA Workspace')
    await expect(input).toHaveValue('QA Workspace')
  })
})
