import { Page } from '@playwright/test'

export const WORKSPACE_ID = 'cmpyd787s000612faqzkktf5l'
export const BOARD_ID = 'cmpzw4m9y0024fye2mrg72382'
export const BOARD_URL = `/boards/${BOARD_ID}`

export async function loginViaUI(page: Page) {
  await page.goto('/login')
  // LoginPage pre-fills tacosta@condor.com.py / password123 by default
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await page.waitForURL(/boards|workspace/, { timeout: 25_000 })
}

export async function gotoBoard(page: Page) {
  await loginViaUI(page)
  await page.goto(BOARD_URL)
  await page.waitForSelector('text=tarea 1', { timeout: 20_000 })
}
