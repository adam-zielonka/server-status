import { expect, test, type Page } from '@playwright/test'

test.setTimeout(90000)
test.use({ actionTimeout: 15000 })

async function stress(page: Page, mode = 'crossing') {
  await page.clock.setFixedTime(new Date('2026-10-29T12:00:00Z'))
  await page.route('**/src/lib/demo.ts', async (route) => {
    const response = await route.fetch()
    const source = (await response.text()).replace(
      'function demoTelemetry(',
      'function originalDemoTelemetry(',
    )
    expect(source).toContain('function originalDemoTelemetry(')
    await route.fulfill({
      response,
      body:
        source +
        `
function demoTelemetry(now = Date.now()) {
  const s = originalDemoTelemetry(now);
  s.cpu_capacity = { peak_cores: 1, observed_since: new Date(now - 86400000).toISOString() };
  s.history = Array.from({length:1441}, (_,i) => {
    const v = 20+60*(Math.sin(i/25)+1)/2;
    const missing = i%120===60;
    return {at:new Date(now-(1440-i)*60000).toISOString(),cpu_capacity_cores:1,
      cpu_usage_cores:missing?null:v/100,cpu_percent:missing?null:v,
      memory_percent:missing?null:${mode === 'overlap' ? 'v' : '100-v'},disk_percent:missing?null:${mode === 'overlap' ? 'v' : '50'}};
  });
  s.services=[];
  s.directories[0].error='Synthetic directory error';
  s.databases=[{name:'Synthetic DB',status:'unknown',checked_at:new Date(now).toISOString(),limit_bytes:200000000,error:'Synthetic database error'}];
  ${mode === 'empty' ? 's.history=[];' : ''}
  ${mode === 'stale' ? 's.collected_at=new Date(now-3600000).toISOString();' : ''}
  return s;
}
`,
    })
  })
}

const chart = (page: Page) =>
  page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole('heading', { name: 'Resource history', exact: true }) })
const curves = (page: Page) => chart(page).locator('.recharts-line-curve')

async function contrast(page: Page, selector: string, property: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((el, property) => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      const context = canvas.getContext('2d')!
      const rgba = (color: string) => {
        context.clearRect(0, 0, 1, 1)
        context.fillStyle = color
        context.fillRect(0, 0, 1, 1)
        return [...context.getImageData(0, 0, 1, 1).data]
      }
      const fg = rgba(getComputedStyle(el).getPropertyValue(property))
      let bg = [255, 255, 255, 255]
      const ancestors = []
      for (let node: Element | null = el; node; node = node.parentElement) ancestors.unshift(node)
      for (const node of ancestors) {
        const c = rgba(getComputedStyle(node).backgroundColor)
        const a = c[3] / 255
        bg = bg.map((v, i) => (i < 3 ? c[i] * a + v * (1 - a) : 255))
      }
      const blended = fg.map((v, i) =>
        i < 3 ? (v * fg[3]) / 255 + bg[i] * (1 - fg[3] / 255) : 255,
      )
      const lum = (rgb: number[]) =>
        rgb
          .slice(0, 3)
          .map((v) => v / 255)
          .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
          .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0)
      const l1 = lum(blended),
        l2 = lum(bg)
      return {
        foreground: fg,
        background: bg,
        ratio: (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05),
        grayscaleRatio: (() => {
          const g = (rgb: number[]) =>
            rgb.slice(0, 3).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0)
          const a = lum([g(blended), g(blended), g(blended)])
          const b = lum([g(bg), g(bg), g(bg)])
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
        })(),
      }
    }, property)
}

test('resource series remain identifiable with gaps, overlap, keyboard and a sample table', async ({
  page,
}, info) => {
  await stress(page)
  await page.goto('/')
  const card = chart(page)
  await expect(curves(page)).toHaveCount(3, { timeout: 15000 })
  await expect(curves(page).nth(1)).toHaveAttribute('stroke-dasharray', '8 4')
  await expect(curves(page).nth(2)).toHaveAttribute('stroke-dasharray', '2 4')
  expect(await curves(page).first().getAttribute('d')).toMatch(/M.*M/)
  await expect(page.getByText('No system services configured for monitoring')).toBeVisible()
  for (const [hours, count] of [
    ['1h', 61],
    ['6h', 361],
    ['24h', 1441],
  ] as const) {
    await card.getByRole('tab', { name: hours, exact: true }).click()
    await expect(card.getByText(`View recorded samples (${count})`)).toBeVisible()
    for (const name of ['CPU capacity', 'Memory', 'Disk']) {
      const button = card.getByRole('button', { name, exact: true })
      await button.focus()
      await page.keyboard.press('Enter')
      await expect(button).toHaveAttribute('aria-pressed', 'true')
      await expect(curves(page)).toHaveCount(1)
    }
    await card.getByRole('button', { name: 'All series' }).click()
  }
  const evidenceDir = process.env.READABILITY_SCREENSHOTS_DIR
  if (evidenceDir && ['phone', 'desktop'].includes(info.project.name)) {
    await card.scrollIntoViewIfNeeded()
    for (const theme of ['light', 'dark']) {
      await page.evaluate(
        (theme) => document.documentElement.classList.toggle('dark', theme === 'dark'),
        theme,
      )
      for (const gray of [false, true]) {
        await page.evaluate(
          (gray) => (document.documentElement.style.filter = gray ? 'grayscale(1)' : ''),
          gray,
        )
        await card.screenshot({
          path: `${evidenceDir}/crossing-${info.project.name}-${theme}-${gray ? 'gray' : 'color'}.png`,
        })
      }
    }
    await page.evaluate(() => (document.documentElement.style.filter = ''))
  }
  await card.getByText('View recorded samples (1441)').click()
  await expect(card.getByRole('table')).toBeVisible()
  await expect(card.getByRole('row')).toHaveCount(51)
  await card.getByRole('button', { name: 'Older samples' }).click()
  await expect(card.getByText('Page 2 of 29')).toBeVisible()
  await expect(
    card.getByRole('table').getByRole('cell', { name: 'Unavailable', exact: true }),
  ).toHaveCount(3, { timeout: 15000 })
  await card.getByRole('tab', { name: '1h', exact: true }).click()
  await expect(card.getByText('Page 1 of 2')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('actual axis and error text contrast passes in both themes, including grayscale evidence', async ({
  page,
}, info) => {
  await stress(page, 'overlap')
  await page.goto('/')
  const card = chart(page)
  await expect(curves(page)).toHaveCount(3, { timeout: 15000 })
  const paths = await curves(page).evaluateAll((nodes) => nodes.map((n) => n.getAttribute('d')))
  expect(new Set(paths).size).toBe(1)
  for (const theme of ['light', 'dark']) {
    await page.evaluate(
      (theme) => document.documentElement.classList.toggle('dark', theme === 'dark'),
      theme,
    )
    const axis = await contrast(
      page,
      '.resource-history-chart .recharts-cartesian-axis-tick-value',
      'fill',
    )
    expect(axis.ratio).toBeGreaterThanOrEqual(4.5)
    expect(axis.grayscaleRatio).toBeGreaterThanOrEqual(4.5)
    console.log(JSON.stringify({ theme, kind: 'axis', ...axis }))
    await card.getByRole('button', { name: 'Memory', exact: true }).click()
    await expect(curves(page)).toHaveCount(1)
    const dir = process.env.READABILITY_SCREENSHOTS_DIR
    if (dir && ['phone', 'desktop'].includes(info.project.name)) {
      await card.scrollIntoViewIfNeeded()
      for (const gray of [false, true]) {
        await page.evaluate(
          (gray) => (document.documentElement.style.filter = gray ? 'grayscale(1)' : ''),
          gray,
        )
        await card.screenshot({
          path: `${dir}/history-${info.project.name}-${theme}-${gray ? 'gray' : 'color'}.png`,
        })
      }
      await page.evaluate(() => (document.documentElement.style.filter = ''))
    }
    await page
      .getByRole('navigation', {
        name: page.viewportSize()!.width < 1024 ? 'Mobile navigation' : 'Main navigation',
        exact: true,
      })
      .locator('a[href="#storage"]')
      .click()
    for (const message of ['Synthetic database error', 'Synthetic directory error']) {
      await expect(page.getByText(message, { exact: true })).toBeVisible()
      const result = await contrast(
        page,
        message.includes('database')
          ? 'span:has-text("Synthetic database error")'
          : 'span:has-text("Synthetic directory error")',
        'color',
      )
      expect(result.ratio).toBeGreaterThanOrEqual(4.5)
      expect(result.grayscaleRatio).toBeGreaterThanOrEqual(4.5)
      console.log(JSON.stringify({ theme, kind: message, ...result }))
    }
    await page
      .getByRole('navigation', {
        name: page.viewportSize()!.width < 1024 ? 'Mobile navigation' : 'Main navigation',
        exact: true,
      })
      .locator('a[href="#overview"]')
      .click()
    await expect(curves(page)).toHaveCount(3, { timeout: 15000 })
  }
})

test('empty history and stale empty services retain honest states', async ({ page }) => {
  await stress(page, 'empty')
  await page.goto('/')
  await expect(chart(page).getByText('History is collecting')).toBeVisible()
  await expect(page.getByText('No system services configured for monitoring')).toBeVisible()
})

test('stale monitoring is not presented as healthy empty services', async ({ page }) => {
  await stress(page, 'stale')
  await page.goto('/')
  await expect(page.getByText('Last observed state · monitoring data is stale')).toBeVisible()
  await expect(page.getByText('All monitored services are active')).toHaveCount(0)
})
