import { expect, test, type Page } from '@playwright/test'

test.setTimeout(90_000)
test.use({ actionTimeout: 15_000 })

async function fixture(page: Page, mode: string) {
  await page.clock.setFixedTime(new Date('2026-01-01T12:00:00Z'))
  await page.route('**/src/lib/demo.ts', async (route) => {
    const response = await route.fetch()
    const source = (await response.text()).replace(
      'function demoTelemetry(',
      'function originalDemoTelemetry(',
    )
    await route.fulfill({
      response,
      body:
        source +
        `
function demoTelemetry(now=Date.now()) {
 const s=originalDemoTelemetry(now), q=s.agent_queue;
 ${mode === 'empty' ? `for(const k of Object.keys(q.counts.statuses)) q.counts.statuses[k]=0; for(const k of ['open','queued','active','waiting','blocked']) q.counts[k]=0;` : ''}
 ${mode === 'error' ? `q.status='error';q.error='Synthetic source error; last complete result retained.';q.last_success_at=new Date(now-1800000).toISOString();` : ''}
 ${mode === 'missing' ? `q.status='unavailable';q.counts=null;q.last_success_at=null;q.error='Synthetic source unavailable.';` : ''}
 return s;
}`,
    })
  })
}

for (const mode of ['mixed', 'empty', 'error', 'missing']) {
  test(`agent tasks ${mode}: responsive groups and separate scheduled jobs`, async ({
    page,
  }, info) => {
    await fixture(page, mode)
    await page.goto('/')
    const summary = page.getByRole('region', { name: 'Agent task summary' })
    await expect(summary).toBeVisible({ timeout: 15_000 })
    await expect(summary.getByLabel('Open agent tasks')).toHaveText(
      mode === 'empty' ? '0' : mode === 'missing' ? '—' : '12',
    )
    const grid = summary.locator('dl').first()
    const boxes = await grid.locator(':scope > div').evaluateAll((nodes) =>
      nodes.map((n) => {
        const r = n.getBoundingClientRect()
        return { x: r.x, y: r.y, width: r.width }
      }),
    )
    expect(boxes).toHaveLength(4)
    if (info.project.name === 'phone' || info.project.name === 'small-phone') {
      expect(boxes[0].y).toBe(boxes[1].y)
      expect(boxes[2].y).toBeGreaterThan(boxes[0].y)
      expect(boxes[2].y).toBe(boxes[3].y)
    }
    await page.getByRole('button', { name: 'Details', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tasks & backups')
    await expect(
      page.getByRole('heading', { name: 'Scheduled tasks & backups', exact: true }),
    ).toBeVisible()
    await expect(page.getByLabel('Agent task statuses')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (mode === 'error') {
      await expect(page.getByText('Stale', { exact: true })).toBeVisible()
      await expect(page.getByText('Source error', { exact: true })).toBeVisible()
    }
    if (mode === 'missing') await expect(page.getByText('No data', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open task board' })).toHaveAttribute(
      'href',
      'https://github.com/users/example/projects/1',
    )
    const dir = process.env.AGENT_QUEUE_SCREENSHOTS_DIR
    if (
      dir &&
      ['phone', 'desktop'].includes(info.project.name) &&
      ['mixed', 'error'].includes(mode)
    )
      await page.screenshot({
        path: `${dir}/agent-queue-${mode}-${info.project.name}.png`,
        fullPage: true,
      })
  })
}
