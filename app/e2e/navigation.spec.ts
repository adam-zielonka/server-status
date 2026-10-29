import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

const version = readFileSync(new URL('../../VERSION', import.meta.url), 'utf8').trim()
const views = [
  'Services',
  'Processes',
  'Storage',
  'Network',
  'System',
  'Software',
  'Tasks & backups',
  'Overview',
]

function navigation(page: Page) {
  return page.getByRole('navigation', {
    name: page.viewportSize()!.width < 1024 ? 'Mobile navigation' : 'Main navigation',
    exact: true,
  })
}

async function expectMenuVisible(page: Page) {
  const nav = navigation(page)
  const active = nav.locator('[aria-current="page"]')
  await expect(active).toBeInViewport({ ratio: 1 })
  if (page.viewportSize()!.width < 1024) {
    const header = await page.locator('header').boundingBox()
    const menu = await nav.boundingBox()
    expect(menu!.y).toBeGreaterThanOrEqual(header!.y + header!.height)
    expect(menu!.y + menu!.height).toBeLessThan(page.viewportSize()!.height)
  }
}

test('all views retain navigation after changing pages and scrolling', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Server overview' })).toBeVisible()
  for (const name of views) {
    await navigation(page)
      .locator(`a[href="#${name === 'Tasks & backups' ? 'tasks' : name.toLowerCase()}"]`)
      .click()
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toHaveText(name === 'Overview' ? 'Server overview' : name)
    await expect(heading).toBeFocused()
    await expectMenuVisible(page)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await expectMenuVisible(page)
  }
  expect(errors).toEqual([])
})

test('history, deep links, skip link, theme and version remain usable', async ({ page }) => {
  await page.goto('/#system')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('System')
  await expectMenuVisible(page)
  await navigation(page).locator('a[href="#software"]').click()
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('System')
  await expectMenuVisible(page)
  await page.goForward()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Software')
  await expectMenuVisible(page)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Software')
  await page.getByRole('link', { name: 'Skip to content' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('#main-content')).toBeFocused()
  await expectMenuVisible(page)
  await page.getByRole('button', { name: 'Use dark theme' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Use light theme' })).toBeVisible()
  const release = page.getByRole('link', { name: `Server Status v${version}`, exact: true })
  await expect(release).toHaveAttribute(
    'href',
    `https://github.com/adam-zielonka/server-status/releases/tag/v${version}`,
  )
  await page.getByRole('button', { name: 'Sign out' }).filter({ visible: true }).click()
  await expect(page.getByLabel('Username')).toBeVisible()
  await expect(release).toBeVisible()
})

test('CPU explanation stays compact and works with pointer, keyboard and touch', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  const card = page.getByRole('group', { name: 'CPU capacity', exact: true })
  await expect(card.getByText('Relative to peak', { exact: true })).toBeVisible()
  const value = await card.locator('p[title]').first().innerText()
  const trigger = card.getByRole('button', { name: 'About CPU capacity' })
  const panel = page.getByRole('dialog', { name: 'About CPU capacity' })
  await expect(panel).not.toBeVisible()
  const screenshotDir = process.env.CPU_HELP_SCREENSHOTS_DIR
  if (screenshotDir && testInfo.project.name === 'desktop') {
    await card.screenshot({ path: `${screenshotDir}/cpu-capacity-compact.png` })
  }
  if (testInfo.project.use.hasTouch) await trigger.tap()
  else await trigger.hover()
  await expect(panel).toBeVisible()
  await expect(panel).toContainText('100% = highest observed use')
  const box = await panel.boundingBox()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
  if (screenshotDir && testInfo.project.name === 'desktop') {
    await page.screenshot({ path: `${screenshotDir}/cpu-capacity-explanation.png` })
  }
  await page.keyboard.press('Escape')
  await expect(panel).not.toBeVisible()
  await trigger.blur()
  await trigger.focus()
  await expect(panel).toBeVisible()
  await page.getByRole('heading', { name: 'Server overview' }).click()
  await expect(panel).not.toBeVisible()
  await trigger.click()
  await expect(panel).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(panel).not.toBeVisible()
  await expect(card.locator('p[title]').first()).toHaveText(value)
})
