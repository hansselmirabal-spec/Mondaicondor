import { test, expect } from '@playwright/test'
import { gotoBoard } from './helpers'

async function clickAddElement(page: import('@playwright/test').Page) {
  await page.locator('button.bg-blue-600', { hasText: 'Agregar elemento' }).click()
}

// Modal is NOT a dialog element — find it by its h2 title
async function expectModalVisible(page: import('@playwright/test').Page, title: string) {
  await expect(page.locator('h2', { hasText: title })).toBeVisible({ timeout: 5_000 })
}

async function expectModalClosed(page: import('@playwright/test').Page, title: string) {
  await expect(page.locator('h2', { hasText: title })).not.toBeVisible({ timeout: 5_000 })
}

test.describe('Task creation', () => {
  test.beforeEach(async ({ page }) => {
    await gotoBoard(page)
  })

  test('Agregar elemento button opens modal', async ({ page }) => {
    await clickAddElement(page)
    await expectModalVisible(page, 'Nuevo elemento')
    await expect(page.getByPlaceholder('Nombre del elemento...')).toBeVisible()
  })

  test('modal has Crear tarea submit button', async ({ page }) => {
    await clickAddElement(page)
    await expectModalVisible(page, 'Nuevo elemento')
    await expect(page.getByRole('button', { name: /crear tarea/i })).toBeVisible()
  })

  test('creates task and it appears in the board', async ({ page }) => {
    const name = `QA Task ${Date.now()}`
    await clickAddElement(page)
    await page.getByPlaceholder('Nombre del elemento...').fill(name)
    await page.getByRole('button', { name: /crear tarea/i }).click()
    await expectModalClosed(page, 'Nuevo elemento')
    await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 })
  })

  test('created task survives page reload (persisted in backend)', async ({ page }) => {
    const name = `QA Persist ${Date.now()}`
    await clickAddElement(page)
    await page.getByPlaceholder('Nombre del elemento...').fill(name)
    await page.getByRole('button', { name: /crear tarea/i }).click()
    await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 })
    await page.reload()
    await page.waitForSelector('text=tarea 1', { timeout: 20_000 })
    await expect(page.getByText(name)).toBeVisible()
  })

  test('Enter key submits form', async ({ page }) => {
    const name = `QA Enter ${Date.now()}`
    await clickAddElement(page)
    await page.getByPlaceholder('Nombre del elemento...').fill(name)
    await page.keyboard.press('Enter')
    await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 })
  })

  test('Cancelar closes modal without creating task', async ({ page }) => {
    await clickAddElement(page)
    await page.getByPlaceholder('Nombre del elemento...').fill('should not appear')
    await page.getByRole('button', { name: /cancelar/i }).click()
    await expectModalClosed(page, 'Nuevo elemento')
    await expect(page.getByText('should not appear')).not.toBeVisible()
  })
})
