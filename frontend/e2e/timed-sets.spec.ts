import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { API, PASSWORD, auth, createExerciseViaApi, exerciseId, registerViaApi } from './helpers.js'
import type { ApiUser } from './helpers.js'

async function login(page: Page, user: ApiUser) {
  await page.addInitScript(() => localStorage.setItem('gymtrack.lang', 'en'))
  await page.goto('/login')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
}

test('a plank set is logged in seconds, with and without added weight', async ({ page, request }) => {
  const user = await registerViaApi(request, 'timed-plank')
  await login(page, user)
  await page.goto('/workout')
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByLabel('Exercise').selectOption(await exerciseId(request, user, 'Plank'))

  await expect(page.locator('#set-reps')).toHaveCount(0)
  await page.getByLabel('Duration (seconds)').fill('45')
  await page.getByRole('button', { name: 'Log set' }).click()
  const sessionSets = page.getByRole('list').filter({ hasText: 'Plank' })
  await expect(sessionSets.getByText('45 s', { exact: true })).toBeVisible()

  await page.getByLabel('Added weight (kg), optional').fill('5')
  await page.getByRole('button', { name: 'Log set' }).click()
  await expect(sessionSets.getByText('45 s × 5 kg')).toBeVisible()
})

test('a plank plan entry shows its seconds target in the walkthrough', async ({ page, request }) => {
  const user = await registerViaApi(request, 'timed-plan')
  const plank = await exerciseId(request, user, 'Plank')
  const created = await request.post(`${API}/api/training-plans`, {
    ...auth(user),
    data: { name: 'Core day', entries: [{ exerciseId: plank, sets: 3, targetDurationSeconds: 45 }] },
  })
  expect(created.ok()).toBe(true)

  await login(page, user)
  await page.goto('/workout')
  await page.getByRole('button', { name: 'Start plan Core day' }).click()
  await expect(page.getByRole('button', { name: 'End workout' })).toBeVisible()
  await expect(page.locator('.walkthrough-entry').first()).toContainText('3 × 45 s')
})

test('changing the measure of a custom exercise that has sets shows the in-use message', async ({ page, request }) => {
  const user = await registerViaApi(request, 'timed-lock')
  const id = await createExerciseViaApi(request, user, 'Locked Hold', { measure: 'DURATION', weightMode: 'NONE' })
  const session = await request.post(`${API}/api/workout-sessions`, auth(user))
  const logged = await request.post(`${API}/api/workout-sessions/${(await session.json()).id}/sets`, {
    ...auth(user),
    data: { exerciseId: id, durationSeconds: 30 },
  })
  expect(logged.ok()).toBe(true)

  await login(page, user)
  await page.goto(`/exercises/${id}/edit`)
  await page.locator('#exercise-measure').selectOption('REPS')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText(
    'The weight and measure settings cannot be changed because this exercise already has logged sets.',
  )
})
