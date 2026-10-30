import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import { API, PASSWORD, auth, exerciseIdByGroup, registerViaApi } from './helpers.js'
import type { ApiUser } from './helpers.js'

/*
 * Workout visual + state spec (change: workout-ui-contract).
 *
 * BASELINES: the screenshots in workout-ui.spec.ts-snapshots/ are platform-specific (Playwright appends
 * the OS to the file name, e.g. "-chromium-win32.png"). The first ones were generated on Windows; Linux
 * baselines come from the CI run's own images and are reviewed by eye. They are created deliberately with
 * `npm run test:e2e -- workout-ui.spec.ts --update-snapshots` and are NEVER refreshed later without an
 * explained visual delta.
 *
 * 7-state matrix:
 *   default        - screenshots: desktop + 375px, light + dark, plan session with one logged set
 *                    (progression chart masked, user e-mail pinned)
 *   hover          - hovered walkthrough row border colour differs from rest
 *   focus-visible  - keyboard focus on a walkthrough row shows an outline equal to --ring
 *   disabled       - free-form session without a selected exercise: Log set disabled, opacity below 1
 *   error          - current-session request fails -> role="alert" visible in the --danger colour
 *   empty          - free-form session without sets shows the noSets text, not a blank frame
 *   loading        - skeleton card visible while exercises are delayed; card height stable after load
 * No state is N/A.
 */

async function seedPlanSession(request: APIRequestContext, user: ApiUser) {
  const groups = ['CHEST', 'BACK', 'QUADS']
  const ids: string[] = []
  for (const group of groups) {
    ids.push(await exerciseIdByGroup(request, user, group))
  }
  const plan = await request.post(`${API}/api/training-plans`, {
    ...auth(user),
    data: { name: 'Full body', entries: ids.map((exerciseId) => ({ exerciseId, sets: 3, reps: 8 })) },
  })
  const planId = (await plan.json()).id
  const session = await request.post(`${API}/api/workout-sessions`, { ...auth(user), data: { planId } })
  const sessionId = (await session.json()).id
  await request.post(`${API}/api/workout-sessions/${sessionId}/sets`, {
    ...auth(user),
    data: { exerciseId: ids[0], reps: 8, weightKg: 60 },
  })
}

async function startFreeForm(request: APIRequestContext, user: ApiUser) {
  const response = await request.post(`${API}/api/workout-sessions`, auth(user))
  expect(response.status()).toBe(201)
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

test.describe('workout ui', () => {
  let seeded: ApiUser

  test.beforeAll(async ({ request }) => {
    seeded = await registerViaApi(request, 'workout-ui')
    await seedPlanSession(request, seeded)
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
        await page.goto('/workout')
        await expect(page.locator('.walkthrough-entry').first()).toBeVisible()
        await expect(page.locator('.set-item')).toHaveCount(1)
        await expect(page.locator('.skeleton')).toHaveCount(0)
        await expect(page.locator('.recharts-responsive-container')).toBeVisible()
        // The generated e-mail differs per run (and in width); pin it so the layout is stable.
        await page.locator('.topbar-user').evaluate((el) => {
          el.textContent = 'user@example.com'
        })
        await expect(page).toHaveScreenshot(`workout-${label}-${scheme}.png`, {
          fullPage: true,
          maxDiffPixels: 150,
          animations: 'disabled',
          mask: [page.locator('.recharts-responsive-container'), page.locator('.previous-workout-hint')],
        })
      })
    }
  }

  test('hover: walkthrough row border colour changes', async ({ page }) => {
    await login(page, seeded)
    await page.goto('/workout')
    // The last row is neither selected nor current, so only hover changes its border.
    const row = page.locator('.walkthrough-entry').last()
    await expect(row).toBeVisible()
    await page.mouse.move(0, 0)
    const rest = await row.evaluate((el) => getComputedStyle(el).borderTopColor)
    await row.hover()
    await expect.poll(() => row.evaluate((el) => getComputedStyle(el).borderTopColor)).not.toBe(rest)
  })

  test('focus-visible: keyboard focus on a walkthrough row shows the --ring outline', async ({ page }) => {
    await login(page, seeded)
    await page.goto('/workout')
    const row = page.locator('.walkthrough-entry').first()
    await expect(row).toBeVisible()
    let focused = false
    for (let i = 0; i < 30 && !focused; i++) {
      await page.keyboard.press('Tab')
      focused = await row.evaluate((el) => el === document.activeElement)
    }
    expect(focused).toBe(true)
    const outline = await row.evaluate((el) => {
      const style = getComputedStyle(el)
      return { color: style.outlineColor, style: style.outlineStyle, width: style.outlineWidth }
    })
    expect(outline.style).not.toBe('none')
    expect(outline.width).not.toBe('0px')
    expect(outline.color).toBe(await cssVar(page, '--ring'))
  })

  test('disabled: Log set is disabled while no exercise is selected', async ({ page, request }) => {
    const fresh = await registerViaApi(request, 'workout-ui-disabled')
    await startFreeForm(request, fresh)
    await login(page, fresh)
    await page.goto('/workout')
    const logSet = page.getByRole('button', { name: 'Log set' })
    await expect(logSet).toBeVisible()
    await expect(logSet).toBeDisabled()
    const opacity = await logSet.evaluate((el) => Number(getComputedStyle(el).opacity))
    expect(opacity).toBeLessThan(1)
  })

  test('error: failed current-session request shows the alert in the --danger colour', async ({ page }) => {
    await login(page, seeded)
    await page.route('**/api/workout-sessions/current', (route) => route.abort())
    await page.goto('/workout')
    const alert = page.getByRole('alert').filter({ hasText: 'Failed to load workout' })
    await expect(alert).toBeVisible()
    expect(await alert.getAttribute('role')).toBe('alert')
    expect(await alert.evaluate((el) => getComputedStyle(el).color)).toBe(await cssVar(page, '--danger'))
  })

  test('empty: a free-form session without sets shows the empty text', async ({ page, request }) => {
    const fresh = await registerViaApi(request, 'workout-ui-empty')
    await startFreeForm(request, fresh)
    await login(page, fresh)
    await page.goto('/workout')
    await expect(page.getByText('No sets logged yet.')).toBeVisible()
  })

  test('loading: skeleton card shows while exercises are delayed and the card height stays stable', async ({
    page,
    request,
  }) => {
    const fresh = await registerViaApi(request, 'workout-ui-loading')
    // A saved plan makes the start screen its fullest (plan select + two buttons).
    const chest = await exerciseIdByGroup(request, fresh, 'CHEST')
    await request.post(`${API}/api/training-plans`, {
      ...auth(fresh),
      data: { name: 'Push', entries: [{ exerciseId: chest, sets: 3, reps: 8 }] },
    })
    await login(page, fresh)
    await page.route('**/api/exercises*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      await route.continue()
    })
    await page.goto('/workout')
    const card = page.locator('.workout-card')
    await expect(page.locator('.skeleton-block')).toBeVisible()
    await expect(page.getByRole('status')).toBeAttached()
    const before = (await card.boundingBox())!.height
    await expect(page.locator('.skeleton')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Start workout' })).toBeVisible()
    const after = (await card.boundingBox())!.height
    // The skeleton is sized to the fullest start screen (saved plan: plan select + two buttons); the
    // card height must stay within a small tolerance when the content replaces it.
    expect(Math.abs(after - before)).toBeLessThanOrEqual(24)
  })
})
