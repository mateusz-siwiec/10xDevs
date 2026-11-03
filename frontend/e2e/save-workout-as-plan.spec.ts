import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import { API, PASSWORD, auth, exerciseId, registerViaApi } from './helpers.js'
import type { ApiUser } from './helpers.js'

interface PlanDetail {
  name: string
  exercises: { exerciseId: string; position: number; sets: number; reps: number }[]
}

async function logSetViaApi(request: APIRequestContext, user: ApiUser, sessionId: string, exId: string, reps: number) {
  const response = await request.post(`${API}/api/workout-sessions/${sessionId}/sets`, {
    ...auth(user),
    data: { exerciseId: exId, reps, weightKg: 60 },
  })
  expect(response.ok()).toBe(true)
}

async function login(page: Page, user: ApiUser) {
  await page.addInitScript(() => localStorage.setItem('gymtrack.lang', 'en'))
  await page.goto('/login')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
}

async function findPlan(request: APIRequestContext, user: ApiUser, name: string): Promise<PlanDetail> {
  const list = await request.get(`${API}/api/training-plans`, auth(user))
  const plans: { id: string; name: string }[] = await list.json()
  const match = plans.find((p) => p.name === name)
  expect(match, `plan "${name}" exists`).toBeTruthy()
  const detail = await request.get(`${API}/api/training-plans/${match!.id}`, auth(user))
  return (await detail.json()) as PlanDetail
}

// Seeded sets, in logged order: bench x3 (reps 8, 8, 6), squat x2 (reps 10, 12).
async function seedSets(request: APIRequestContext, user: ApiUser, sessionId: string, bench: string, squat: string) {
  for (const [exId, reps] of [
    [bench, 8],
    [bench, 8],
    [bench, 6],
    [squat, 10],
    [squat, 12],
  ] as const) {
    await logSetViaApi(request, user, sessionId, exId, reps)
  }
}

function expectEntries(plan: PlanDetail, bench: string, squat: string) {
  const entries = [...plan.exercises].sort((a, b) => a.position - b.position)
  expect(entries.map((e) => e.exerciseId)).toEqual([bench, squat])
  expect(entries.map((e) => e.sets)).toEqual([3, 2])
  // Most common reps per run; ties go to the higher value (10 vs 12 -> 12).
  expect(entries.map((e) => e.reps)).toEqual([8, 12])
}

test('a finished workout can be saved as a plan from its history detail page', async ({ page, request }) => {
  const user = await registerViaApi(request, 'saveplan-history')
  const bench = await exerciseId(request, user, 'Barbell Bench Press')
  const squat = await exerciseId(request, user, 'Back Squat')
  const session = await request.post(`${API}/api/workout-sessions`, auth(user))
  const sessionId = (await session.json()).id
  await seedSets(request, user, sessionId, bench, squat)
  await request.post(`${API}/api/workout-sessions/${sessionId}/end`, auth(user))

  await login(page, user)
  await page.getByRole('link', { name: 'History' }).click()
  await page.locator('a.history-row').first().click()
  await expect(page.getByText('Set 1: 8 × 60 kg')).toBeVisible()

  await page.getByRole('button', { name: 'Save as plan' }).click()
  await page.getByLabel('Plan name').fill('Push and squat from history')
  await page.getByRole('button', { name: 'Save plan' }).click()
  await expect(page.getByText('Plan saved.')).toBeVisible()

  expectEntries(await findPlan(request, user, 'Push and squat from history'), bench, squat)

  await page.getByRole('link', { name: 'View plan' }).click()
  await expect(page).toHaveURL(/\/plans\/[^/]+$/)
  await page.goto('/plans')
  await expect(page.getByText('Push and squat from history')).toBeVisible()
})

test('a workout can be saved as a plan from the panel shown after ending it', async ({ page, request }) => {
  const user = await registerViaApi(request, 'saveplan-end')
  const bench = await exerciseId(request, user, 'Barbell Bench Press')
  const squat = await exerciseId(request, user, 'Back Squat')
  const session = await request.post(`${API}/api/workout-sessions`, auth(user))
  const sessionId = (await session.json()).id
  await seedSets(request, user, sessionId, bench, squat)

  await login(page, user)
  await page.goto('/workout')
  await expect(page.getByRole('button', { name: 'End workout' })).toBeVisible()

  await page.getByRole('button', { name: 'End workout' }).click()
  await page.getByRole('button', { name: 'Confirm' }).click()

  await expect(page.getByText('Workout saved.')).toBeVisible()
  await page.getByRole('button', { name: 'Save as plan' }).click()
  await page.getByLabel('Plan name').fill('Push and squat after end')
  await page.getByRole('button', { name: 'Save plan' }).click()
  await expect(page.getByText('Plan saved.')).toBeVisible()

  expectEntries(await findPlan(request, user, 'Push and squat after end'), bench, squat)

  await page.goto('/plans')
  await expect(page.getByText('Push and squat after end')).toBeVisible()
})
