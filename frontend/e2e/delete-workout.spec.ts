import { expect, test } from '@playwright/test'
import { API, PASSWORD, auth, exerciseId, registerViaApi } from './helpers.js'

// Test plan risk R10: deleting a workout needs confirmation and must really remove it.
test('a finished workout can be deleted from its detail page after confirming', async ({ page, request }) => {
  const user = await registerViaApi(request, 'delete')
  const bench = await exerciseId(request, user, 'Barbell Bench Press')
  const session = await request.post(`${API}/api/workout-sessions`, auth(user))
  const sessionId = (await session.json()).id
  await request.post(`${API}/api/workout-sessions/${sessionId}/sets`, {
    ...auth(user),
    data: { exerciseId: bench, reps: 8, weightKg: 60 },
  })
  await request.post(`${API}/api/workout-sessions/${sessionId}/end`, auth(user))

  await page.addInitScript(() => localStorage.setItem('gymtrack.lang', 'en'))
  await page.goto('/login')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  await page.getByRole('link', { name: 'History' }).click()
  await page.locator('a.history-row').first().click()
  await expect(page.getByText('Set 1: 8 × 60 kg')).toBeVisible()

  // First click only asks for confirmation; cancelling keeps the workout.
  await page.getByRole('button', { name: 'Delete workout' }).click()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByText('Set 1: 8 × 60 kg')).toBeVisible()

  await page.getByRole('button', { name: 'Delete workout' }).click()
  await page.getByRole('button', { name: 'Confirm' }).click()

  await expect(page.getByText('No completed workouts yet.')).toBeVisible()
  const gone = await request.get(`${API}/api/workout-sessions/${sessionId}`, auth(user))
  expect(gone.status()).toBe(404)
})
