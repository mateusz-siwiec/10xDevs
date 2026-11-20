import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
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

async function openWorkout(page: Page, user: ApiUser) {
  await login(page, user)
  await page.goto('/workout')
  await page.getByRole('button', { name: 'Start workout' }).click()
  await expect(page.getByRole('button', { name: 'End workout' })).toBeVisible()
}

async function pickExercise(page: Page, request: APIRequestContext, user: ApiUser, name: string) {
  await page.getByLabel('Exercise').selectOption(await exerciseId(request, user, name))
}

test('an ab wheel set has no weight field and is logged as reps only', async ({ page, request }) => {
  const user = await registerViaApi(request, 'bodyweight-ab')
  await openWorkout(page, user)
  await pickExercise(page, request, user, 'Ab Wheel Rollout')

  await expect(page.locator('#set-reps')).toBeVisible()
  await expect(page.locator('#set-weight')).toHaveCount(0)
  await page.getByLabel('Reps').fill('10')
  await page.getByRole('button', { name: 'Log set' }).click()

  const sessionSets = page.getByRole('list').filter({ hasText: 'Ab Wheel Rollout' })
  await expect(sessionSets.getByText('10 reps', { exact: true })).toBeVisible()
})

test('a pull-up takes an optional added weight: empty logs reps only, filled logs reps and weight', async ({
  page,
  request,
}) => {
  const user = await registerViaApi(request, 'bodyweight-pullup')
  await openWorkout(page, user)
  await pickExercise(page, request, user, 'Pull-Up')

  await expect(page.getByLabel('Added weight (kg), optional')).toBeVisible()
  await page.getByLabel('Reps').fill('8')
  await page.getByRole('button', { name: 'Log set' }).click()
  const sessionSets = page.getByRole('list').filter({ hasText: 'Pull-Up' })
  await expect(sessionSets.getByText('8 reps', { exact: true })).toBeVisible()

  await page.getByLabel('Added weight (kg), optional').fill('10')
  await page.getByRole('button', { name: 'Log set' }).click()
  await expect(sessionSets.getByText('8 × 10 kg')).toBeVisible()
})

test('changing the weight mode of a custom exercise that has sets shows the in-use message', async ({
  page,
  request,
}) => {
  const user = await registerViaApi(request, 'bodyweight-lock')
  const id = await createExerciseViaApi(request, user, 'Locked Crunch', { weightMode: 'REQUIRED' })
  const session = await request.post(`${API}/api/workout-sessions`, auth(user))
  const logged = await request.post(`${API}/api/workout-sessions/${(await session.json()).id}/sets`, {
    ...auth(user),
    data: { exerciseId: id, reps: 8, weightKg: 20 },
  })
  expect(logged.ok()).toBe(true)

  await login(page, user)
  await page.goto(`/exercises/${id}/edit`)
  await page.locator('#exercise-weight-mode').selectOption('NONE')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText(
    'The weight and measure settings cannot be changed because this exercise already has logged sets.',
  )
})
