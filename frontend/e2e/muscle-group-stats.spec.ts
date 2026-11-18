import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import { API, PASSWORD, auth, exerciseIdByGroup, registerViaApi } from './helpers.js'
import type { ApiUser } from './helpers.js'

type Plan = [group: string, sets: number][]

async function logSets(request: APIRequestContext, user: ApiUser, plan: Plan) {
  const session = await request.post(`${API}/api/workout-sessions`, auth(user))
  const sessionId = (await session.json()).id
  for (const [group, sets] of plan) {
    const exerciseId = await exerciseIdByGroup(request, user, group)
    for (let i = 0; i < sets; i++) {
      await request.post(`${API}/api/workout-sessions/${sessionId}/sets`, {
        ...auth(user),
        data: { exerciseId, reps: 8, weightKg: 50 },
      })
    }
  }
  await request.post(`${API}/api/workout-sessions/${sessionId}/end`, auth(user))
}

async function openStats(page: Page, user: ApiUser, lang: 'en' | 'pl' = 'en') {
  await page.addInitScript((l) => localStorage.setItem('gymtrack.lang', l), lang)
  await page.goto('/login')
  await page.getByLabel(lang === 'pl' ? 'E-mail' : 'Email').fill(user.email)
  await page.getByLabel(lang === 'pl' ? 'Hasło' : 'Password').fill(PASSWORD)
  await page.getByRole('button', { name: lang === 'pl' ? 'Zaloguj się' : 'Log in', exact: true }).click()
  // Leave /login before navigating, otherwise the pending login request is aborted.
  await expect(page).not.toHaveURL(/\/login/)
  await page.goto('/muscle-groups')
}

const parent = (page: Page, key: string) => page.locator(`[data-parent="${key}"]`)
const child = (page: Page, group: string) => page.locator(`[data-group="${group}"]`)

// Test plan risk R11: the per-muscle-group set counts must match what the user actually logged.
test('the muscle group page, opened from the dashboard, shows sets per parent group', async ({ page, request }) => {
  const user = await registerViaApi(request, 'muscles')
  await logSets(request, user, [['CHEST', 3], ['LATS', 2]])

  await page.addInitScript(() => localStorage.setItem('gymtrack.lang', 'en'))
  await page.goto('/login')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  await page.getByRole('link', { name: 'Sets per muscle group' }).click()
  await expect(page.getByRole('heading', { name: 'Sets per muscle group' })).toBeVisible()
  await expect(page.getByText('5 sets in total')).toBeVisible()
  await expect(parent(page, 'CHEST')).toContainText('3')
  await expect(parent(page, 'BACK')).toContainText('2')
  await expect(parent(page, 'CORE')).toContainText('0')

  // Most-trained parent is listed first; the six parents replace the flat list of groups.
  await expect(page.locator('.muscle-list > li').first()).toContainText('Chest')
  await expect(page.locator('.muscle-list > li')).toHaveCount(6)

  await page.getByRole('link', { name: 'Back to dashboard' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
})

test('parents sum their sub-groups, start collapsed and expand to the sub-groups sorted by sets', async ({
  page,
  request,
}) => {
  const user = await registerViaApi(request, 'muscles-sum')
  await logSets(request, user, [['CHEST', 3], ['SIDE_DELTS', 2], ['REAR_DELTS', 1], ['LATS', 1]])
  await openStats(page, user)

  await expect(page.getByText('7 sets in total')).toBeVisible()
  // Shoulders = side 2 + rear 1 = 3; ties keep the hierarchy order (Chest before Shoulders), then Back with 1.
  await expect(page.locator('.muscle-list > li').nth(0)).toContainText('Chest')
  await expect(page.locator('.muscle-list > li').nth(1)).toContainText('Shoulders')
  await expect(page.locator('.muscle-list > li').nth(1)).toContainText('3')
  await expect(page.locator('.muscle-list > li').nth(2)).toContainText('Back')

  const toggle = page.getByRole('button', { name: 'Shoulders', exact: true })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(child(page, 'SIDE_DELTS')).toBeHidden()
  // Chest has a single group and therefore no toggle.
  await expect(page.getByRole('button', { name: 'Chest', exact: true })).toHaveCount(0)

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(child(page, 'SIDE_DELTS')).toContainText('Side delts')
  await expect(child(page, 'SIDE_DELTS')).toContainText('2')
  await expect(child(page, 'REAR_DELTS')).toContainText('1')
  await expect(child(page, 'FRONT_DELTS')).toContainText('0')
  const names = await parent(page, 'SHOULDERS').locator('.muscle-children .muscle-name').allTextContents()
  expect(names).toEqual(['Side delts', 'Rear delts', 'Front delts'])
  // Other parents stay collapsed.
  await expect(child(page, 'LATS')).toBeHidden()

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(child(page, 'SIDE_DELTS')).toBeHidden()
})

test('the toggle works with the keyboard and an expanded parent stays open when the window changes', async ({
  page,
  request,
}) => {
  const user = await registerViaApi(request, 'muscles-kbd')
  await logSets(request, user, [['LATS', 2], ['QUADS', 1]])
  await openStats(page, user)

  const toggle = page.getByRole('button', { name: 'Back', exact: true })
  await toggle.focus()
  await page.keyboard.press('Enter')
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(child(page, 'LATS')).toContainText('2')
  await page.keyboard.press('Space')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await page.keyboard.press('Space')
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')

  // Switching the time window reloads the numbers but keeps the expansion.
  await page.getByRole('button', { name: '7', exact: true }).click()
  await expect(page.getByRole('button', { name: '7', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('3 sets in total')).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(child(page, 'LATS')).toContainText('2')
})

test('failure sets are counted on the parent and the muscle row, and groups without them show nothing', async ({
  page,
  request,
}) => {
  const user = await registerViaApi(request, 'muscles-failure')
  const sideDelts = await exerciseIdByGroup(request, user, 'SIDE_DELTS')
  const rearDelts = await exerciseIdByGroup(request, user, 'REAR_DELTS')
  const chest = await exerciseIdByGroup(request, user, 'CHEST')
  const session = await request.post(`${API}/api/workout-sessions`, auth(user))
  expect(session.ok()).toBeTruthy()
  const sessionId = (await session.json()).id
  const sets: [string, boolean][] = [
    [sideDelts, true],
    [sideDelts, true],
    [sideDelts, false],
    [rearDelts, true],
    [chest, false],
  ]
  for (const [exerciseId, toFailure] of sets) {
    const logged = await request.post(`${API}/api/workout-sessions/${sessionId}/sets`, {
      ...auth(user),
      data: { exerciseId, reps: 8, weightKg: 50, toFailure },
    })
    expect(logged.ok()).toBeTruthy()
  }
  const ended = await request.post(`${API}/api/workout-sessions/${sessionId}/end`, auth(user))
  expect(ended.ok()).toBeTruthy()
  await openStats(page, user)

  // Shoulders: 3 failure sets in total (side 2 + rear 1); Chest and Back have none.
  await expect(parent(page, 'SHOULDERS')).toContainText('3 to failure')
  await expect(parent(page, 'CHEST')).not.toContainText('to failure')
  await expect(parent(page, 'BACK')).not.toContainText('to failure')

  await page.getByRole('button', { name: 'Shoulders', exact: true }).click()
  await expect(child(page, 'SIDE_DELTS')).toContainText('2 to failure')
  await expect(child(page, 'REAR_DELTS')).toContainText('1 to failure')
  await expect(child(page, 'FRONT_DELTS')).not.toContainText('to failure')
})

test('in Polish the parents and sub-groups are translated', async ({ page, request }) => {
  const user = await registerViaApi(request, 'muscles-pl')
  await logSets(request, user, [['REAR_DELTS', 2]])
  await openStats(page, user, 'pl')

  const toggle = page.getByRole('button', { name: 'Barki', exact: true })
  await expect(toggle).toBeVisible()
  await toggle.click()
  await expect(child(page, 'REAR_DELTS')).toContainText('Tylna głowa barku')
  await expect(child(page, 'REAR_DELTS')).toContainText('2')
  await expect(page.getByText('Plecy', { exact: true })).toBeVisible()
})
