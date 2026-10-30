import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import { API, PASSWORD, auth, exerciseIdByGroup, registerViaApi } from './helpers.js'
import type { ApiUser } from './helpers.js'

/*
 * Dashboard visual + state spec (change: dashboard-ui-contract).
 *
 * BASELINES: the screenshots in dashboard-ui.spec.ts-snapshots/ are platform-specific (Playwright appends
 * the OS to the file name, e.g. "-chromium-win32.png"); the committed ones were generated on Windows. On
 * another OS run with --update-snapshots once and review by eye. Baselines are created deliberately with
 * `npm run test:e2e -- dashboard-ui.spec.ts --update-snapshots` and are NEVER refreshed later without an
 * explained visual delta.
 *
 * 7-state matrix:
 *   default        - screenshots: desktop + 375px, light + dark (date text and chart masked, user e-mail pinned)
 *   hover          - secondary button border colour differs from rest
 *   focus-visible  - keyboard focus on the primary link shows an outline equal to --ring
 *   disabled       - Save is disabled with an empty goal, opacity below 1
 *   error          - insights request fails -> alert visible in the --danger colour
 *   empty          - fresh user sees the empty-state text, not a blank frame
 *   loading        - skeleton visible while stats are delayed; container height stable after load
 * No state is N/A.
 */

async function seedWorkout(request: APIRequestContext, user: ApiUser) {
  const chest = await exerciseIdByGroup(request, user, 'CHEST')
  const session = await request.post(`${API}/api/workout-sessions`, auth(user))
  const sessionId = (await session.json()).id
  for (const weightKg of [60, 65]) {
    await request.post(`${API}/api/workout-sessions/${sessionId}/sets`, {
      ...auth(user),
      data: { exerciseId: chest, reps: 8, weightKg },
    })
  }
  await request.post(`${API}/api/workout-sessions/${sessionId}/end`, auth(user))
}

async function login(page: Page, user: ApiUser) {
  await page.addInitScript(() => localStorage.setItem('gymtrack.lang', 'en'))
  await page.goto('/login')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
}

/** Resolves a custom property to a computed rgb() string via a probe element. */
function cssVar(page: Page, name: string) {
  return page.evaluate((prop) => {
    const probe = document.createElement('div')
    probe.style.color = `var(${prop})`
    document.body.appendChild(probe)
    const value = getComputedStyle(probe).color
    probe.remove()
    return value
  }, name)
}

test.describe('dashboard ui', () => {
  let seeded: ApiUser

  test.beforeAll(async ({ request }) => {
    seeded = await registerViaApi(request, 'dash-ui')
    await seedWorkout(request, seeded)
  })

  for (const scheme of ['light', 'dark'] as const) {
    for (const [label, size] of [
      ['desktop', { width: 1280, height: 900 }],
      ['mobile', { width: 375, height: 800 }],
    ] as const) {
      test(`default ${label} ${scheme}`, async ({ page }) => {
        await page.setViewportSize(size)
        await page.emulateMedia({ colorScheme: scheme })
        await login(page, seeded)
        await expect(page.locator('.recent-records')).toBeVisible()
        await expect(page.locator('.recharts-bar-rectangle').first()).toBeVisible()
        await expect(page.locator('.skeleton')).toHaveCount(0)
        // The generated e-mail differs per run (and in width); pin it so the layout is stable.
        await page.locator('.topbar-user').evaluate((el) => {
          el.textContent = 'user@example.com'
        })
        await expect(page).toHaveScreenshot(`dashboard-${label}-${scheme}.png`, {
          fullPage: true,
          maxDiffPixels: 150,
          animations: 'disabled',
          mask: [page.locator('.recent-record-detail'), page.locator('.recharts-responsive-container')],
        })
      })
    }
  }

  test('hover: secondary button border colour changes', async ({ page }) => {
    await login(page, seeded)
    const button = page.getByRole('button', { name: '30', exact: true })
    await page.mouse.move(0, 0)
    const rest = await button.evaluate((el) => getComputedStyle(el).borderTopColor)
    await button.hover()
    await expect.poll(() => button.evaluate((el) => getComputedStyle(el).borderTopColor)).not.toBe(rest)
  })

  test('focus-visible: keyboard focus on the primary link shows the --ring outline', async ({ page }) => {
    await login(page, seeded)
    const link = page.getByRole('link', { name: 'Start workout' })
    let focused = false
    for (let i = 0; i < 20 && !focused; i++) {
      await page.keyboard.press('Tab')
      focused = await link.evaluate((el) => el === document.activeElement)
    }
    expect(focused).toBe(true)
    const outline = await link.evaluate((el) => {
      const style = getComputedStyle(el)
      return { color: style.outlineColor, style: style.outlineStyle, width: style.outlineWidth }
    })
    expect(outline.style).not.toBe('none')
    expect(outline.width).not.toBe('0px')
    expect(outline.color).toBe(await cssVar(page, '--ring'))
  })

  test('disabled: Save is disabled with an empty goal', async ({ page, request }) => {
    const fresh = await registerViaApi(request, 'dash-ui-disabled')
    await login(page, fresh)
    const save = page.getByRole('button', { name: 'Save' })
    await expect(save).toBeVisible()
    await expect(save).toBeDisabled()
    const opacity = await save.evaluate((el) => Number(getComputedStyle(el).opacity))
    expect(opacity).toBeLessThan(1)
  })

  test('error: failed insights request shows the alert in the --danger colour', async ({ page }) => {
    await page.route('**/api/dashboard/insights', (route) => route.abort())
    await login(page, seeded)
    const alert = page.getByRole('alert').filter({ hasText: 'Failed to load insights' })
    await expect(alert).toBeVisible()
    expect(await alert.evaluate((el) => getComputedStyle(el).color)).toBe(await cssVar(page, '--danger'))
  })

  test('empty: a fresh user sees the empty-state text', async ({ page, request }) => {
    const fresh = await registerViaApi(request, 'dash-ui-empty')
    await login(page, fresh)
    await expect(page.getByText('No completed workouts in the last 7 days.')).toBeVisible()
    await expect(page.getByText('Start a workout to see your stats here.')).toBeVisible()
  })

  test('loading: skeleton shows while stats are delayed and the layout does not jump', async ({ page }) => {
    await page.route('**/api/dashboard/stats*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      await route.continue()
    })
    await login(page, seeded)
    const tiles = page.locator('.dashboard-tiles')
    await expect(page.locator('.skeleton-tile').first()).toBeVisible()
    const before = (await tiles.boundingBox())!.height
    await expect(page.locator('.skeleton-tile')).toHaveCount(0)
    await expect(page.locator('.stat-value').first()).toBeVisible()
    const after = (await tiles.boundingBox())!.height
    // Skeleton min-height is tuned to the real tile height; allow a couple of px rounding.
    expect(Math.abs(after - before)).toBeLessThanOrEqual(2)
  })
})
