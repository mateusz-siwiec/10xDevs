import { expect, test } from '@playwright/test'
import { API, PASSWORD, auth, exerciseIdByGroup, registerViaApi } from './helpers.js'

// Test plan risk R11: the per-muscle-group set counts must match what the user actually logged.
test('the muscle group page, opened from the dashboard, shows sets per group', async ({ page, request }) => {
  const user = await registerViaApi(request, 'muscles')
  const chest = await exerciseIdByGroup(request, user, 'CHEST')
  const back = await exerciseIdByGroup(request, user, 'BACK')

  const session = await request.post(`${API}/api/workout-sessions`, auth(user))
  const sessionId = (await session.json()).id
  for (const [exerciseId, sets] of [[chest, 3], [back, 2]] as const) {
    for (let i = 0; i < sets; i++) {
      await request.post(`${API}/api/workout-sessions/${sessionId}/sets`, {
        ...auth(user),
        data: { exerciseId, reps: 8, weightKg: 50 },
      })
    }
  }
  await request.post(`${API}/api/workout-sessions/${sessionId}/end`, auth(user))

  await page.addInitScript(() => localStorage.setItem('gymtrack.lang', 'en'))
  await page.goto('/login')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  await page.getByRole('link', { name: 'Sets per muscle group' }).click()
  await expect(page.getByRole('heading', { name: 'Sets per muscle group' })).toBeVisible()
  await expect(page.getByText('5 sets in total')).toBeVisible()
  await expect(page.locator('.muscle-row', { hasText: 'Chest' })).toContainText('3')
  await expect(page.locator('.muscle-row', { hasText: 'Back' })).toContainText('2')
  await expect(page.locator('.muscle-row', { hasText: 'Core' })).toContainText('0')

  // Most-trained group is listed first.
  await expect(page.locator('.muscle-row').first()).toContainText('Chest')

  await page.getByRole('link', { name: 'Back to dashboard' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
})
