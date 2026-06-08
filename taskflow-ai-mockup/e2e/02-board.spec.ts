import { test, expect } from '@playwright/test'
import { gotoBoard } from './helpers'

test.describe('Board rendering', () => {
  test.beforeEach(async ({ page }) => {
    await gotoBoard(page)
  })

  test('renders group name "Tareas"', async ({ page }) => {
    await expect(page.getByText('Tareas')).toBeVisible()
  })

  test('renders task "tarea 1"', async ({ page }) => {
    await expect(page.getByText('tarea 1')).toBeVisible()
  })

  test('board header shows board name "Gerencia"', async ({ page }) => {
    await expect(page.getByText('Gerencia').first()).toBeVisible()
  })

  test('sidebar shows workspace name "Digital"', async ({ page }) => {
    await expect(page.getByText('Digital').first()).toBeVisible()
  })

  test('toolbar shows Agregar elemento button', async ({ page }) => {
    // Use the blue toolbar button (first one, with bg-blue-600)
    await expect(page.locator('button.bg-blue-600', { hasText: 'Agregar elemento' })).toBeVisible()
  })

  test('toolbar shows Automatizar button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Automatizar', exact: true })).toBeVisible()
  })

  test('favicon is an SVG', async ({ page }) => {
    const href = await page.locator('link[rel="icon"]').getAttribute('href')
    expect(href).toContain('svg')
  })

  test('view tabs are present', async ({ page }) => {
    // BoardViewTabs component
    await expect(page.getByText(/tabla|kanban/i).first()).toBeVisible()
  })
})
