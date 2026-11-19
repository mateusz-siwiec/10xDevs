import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import { API, PASSWORD, auth, exerciseIdByGroup, registerViaApi } from './helpers.js'
import type { ApiUser } from './helpers.js'

const GROUPS = ['MID_CHEST', 'LATS', 'QUADS', 'CALVES', 'ABS']

/** Creates a plan with `exercises` distinct exercises (1..5). */
async function createPlan(request: APIRequestContext, user: ApiUser, name: string, exercises: number) {
  const entries = []
  for (const group of GROUPS.slice(0, exercises)) {
    entries.push({ exerciseId: await exerciseIdByGroup(request, user, group), sets: 3, reps: 8 })
  }
  const created = await request.post(`${API}/api/training-plans`, { ...auth(user), data: { name, entries } })
  expect(created.ok()).toBeTruthy()
}

async function openWorkout(page: Page, user: ApiUser, lang: 'en' | 'pl' = 'en') {
  await page.addInitScript((l) => localStorage.setItem('gymtrack.lang', l), lang)
  await page.goto('/login')
  await page.getByLabel(lang === 'pl' ? 'E-mail' : 'Email').fill(user.email)
  await page.getByLabel(lang === 'pl' ? 'Hasło' : 'Password').fill(PASSWORD)
  await page.getByRole('button', { name: lang === 'pl' ? 'Zaloguj się' : 'Log in', exact: true }).click()
  // Leave /login before navigating, otherwise the pending login request is aborted.
  await expect(page).not.toHaveURL(/\/login/)
  await page.goto('/workout')
}

const planRow = (page: Page, name: string) => page.locator('.workout-plan-row').filter({ hasText: name })

test('plans are listed as rows with their exercise count and each starts the workout in one tap', async ({
  page,
  request,
}) => {
  const user = await registerViaApi(request, 'start-plans')
  await createPlan(request, user, 'Push day', 3)
  await createPlan(request, user, 'Arms only', 1)
  await openWorkout(page, user)

  await expect(page.getByRole('heading', { name: 'From a plan' })).toBeVisible()
  await expect(planRow(page, 'Push day')).toContainText('3 exercises')
  await expect(planRow(page, 'Arms only')).toContainText('1 exercise')
  await expect(planRow(page, 'Arms only')).not.toContainText('1 exercises')

  // The plan's own button starts that plan; no dropdown, no second step.
  await page.getByRole('button', { name: 'Start plan Push day' }).click()
  await expect(page.getByRole('button', { name: 'End workout' })).toBeVisible()
  await expect(page.locator('.workout-plans')).toHaveCount(0)
})

test('Start workout stays the primary action and starts a free-form workout', async ({ page, request }) => {
  const user = await registerViaApi(request, 'start-free')
  await createPlan(request, user, 'Push day', 2)
  await openWorkout(page, user)

  // It is listed before the plans, so it is the first thing in the card.
  const buttons = page.locator('.workout-start button')
  await expect(buttons.first()).toHaveText('Start workout')
  await buttons.first().click()
  await expect(page.getByRole('button', { name: 'End workout' })).toBeVisible()
})

test('without plans the screen points to the Plans page instead of showing an empty list', async ({ page, request }) => {
  const user = await registerViaApi(request, 'start-empty')
  await openWorkout(page, user)

  await expect(page.getByText('You have no plans yet.')).toBeVisible()
  await expect(page.locator('.workout-plan-row')).toHaveCount(0)
  await page.getByRole('link', { name: 'Create one in Plans' }).click()
  await expect(page).toHaveURL(/\/plans/)
})

test('only five plans are listed and the rest are one link away', async ({ page, request }) => {
  const user = await registerViaApi(request, 'start-many')
  for (let i = 1; i <= 6; i++) await createPlan(request, user, `Plan ${i}`, 1)
  await openWorkout(page, user)

  await expect(page.locator('.workout-plan-row')).toHaveCount(5)
  await page.getByRole('link', { name: 'All plans' }).click()
  await expect(page).toHaveURL(/\/plans/)
})

test('five or fewer plans show no "All plans" link', async ({ page, request }) => {
  const user = await registerViaApi(request, 'start-five')
  for (let i = 1; i <= 5; i++) await createPlan(request, user, `Plan ${i}`, 1)
  await openWorkout(page, user)

  await expect(page.locator('.workout-plan-row')).toHaveCount(5)
  await expect(page.getByRole('link', { name: 'All plans' })).toHaveCount(0)
})

test('in Polish the section, the exercise counts and the button names are translated', async ({ page, request }) => {
  const user = await registerViaApi(request, 'start-pl')
  await createPlan(request, user, 'Jeden', 1)
  await createPlan(request, user, 'Dwa', 2)
  await createPlan(request, user, 'Piec', 5)
  await openWorkout(page, user, 'pl')

  await expect(page.getByRole('heading', { name: 'Z planu' })).toBeVisible()
  await expect(planRow(page, 'Jeden')).toContainText('1 ćwiczenie')
  await expect(planRow(page, 'Dwa')).toContainText('2 ćwiczenia')
  await expect(planRow(page, 'Piec')).toContainText('5 ćwiczeń')
  await expect(page.getByRole('button', { name: 'Rozpocznij plan Dwa' })).toBeVisible()
})

test('a long unbroken plan name wraps and the page does not scroll sideways on a phone', async ({ page, request }) => {
  const user = await registerViaApi(request, 'start-narrow')
  await createPlan(request, user, 'Supercalifragilisticexpialidocious-and-more-and-more-words', 2)
  await page.setViewportSize({ width: 375, height: 800 })
  await openWorkout(page, user)

  await expect(page.locator('.workout-plan-row')).toHaveCount(1)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  await expect(page.locator('.workout-plan-start')).toBeVisible()
})
