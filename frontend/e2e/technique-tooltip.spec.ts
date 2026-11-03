import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import { API, PASSWORD, auth, exerciseId, registerViaApi } from './helpers.js'
import type { ApiUser } from './helpers.js'

async function login(page: Page, user: ApiUser) {
  await page.addInitScript(() => localStorage.setItem('gymtrack.lang', 'en'))
  await page.goto('/login')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
}

async function startFreeForm(page: Page, request: APIRequestContext, user: ApiUser) {
  const response = await request.post(`${API}/api/workout-sessions`, auth(user))
  expect(response.status()).toBe(201)
  await login(page, user)
  await page.goto('/workout')
  await expect(page.getByLabel('Exercise')).toBeVisible()
}

test('the picker-area trigger follows the selected exercise and disappears for a custom one', async ({
  page,
  request,
}) => {
  const user = await registerViaApi(request, 'tech-picker')
  const custom = `Tech Custom ${Date.now()}`
  const created = await request.post(`${API}/api/exercises`, {
    ...auth(user),
    data: { name: custom, primaryMuscleGroup: 'BICEPS', secondaryMuscleGroups: [] },
  })
  expect(created.ok()).toBe(true)
  const customId = (await created.json()).id as string
  const bench = await exerciseId(request, user, 'Barbell Bench Press')
  const incline = await exerciseId(request, user, 'Incline Dumbbell Press')
  await startFreeForm(page, request, user)

  const anyTrigger = page.getByRole('button', { name: /^How to do/ })
  await expect(anyTrigger).toHaveCount(0)

  await page.getByLabel('Exercise').selectOption(bench)
  const benchTrigger = page.getByRole('button', { name: 'How to do Barbell Bench Press' })
  await expect(benchTrigger).toBeVisible()
  await benchTrigger.click()
  await expect(page.getByRole('tooltip')).toContainText('Lie back with your eyes under the bar')

  await page.getByLabel('Exercise').selectOption(incline)
  const inclineTrigger = page.getByRole('button', { name: 'How to do Incline Dumbbell Press' })
  await expect(inclineTrigger).toBeVisible()
  await expect(benchTrigger).toHaveCount(0)
  await inclineTrigger.click()
  await expect(page.getByRole('tooltip')).toContainText('Set the bench to a 30 to 45 degree incline')
  await expect(page.getByRole('tooltip')).not.toContainText('Lie back with your eyes under the bar')

  await page.getByLabel('Exercise').selectOption(customId)
  await expect(anyTrigger).toHaveCount(0)
  await expect(page.getByRole('tooltip')).toHaveCount(0)
})

test('substitute suggestions expose the trigger for built-in exercises', async ({ page, request }) => {
  const user = await registerViaApi(request, 'tech-subs')
  const bench = await exerciseId(request, user, 'Barbell Bench Press')
  await startFreeForm(page, request, user)

  await page.getByLabel('Exercise').selectOption(bench)
  await page.getByRole('button', { name: 'Find substitute' }).click()
  const panel = page.locator('.substitute-panel')
  const items = panel.locator('.substitute-item')
  await expect(items.first()).toBeVisible()
  const triggers = panel.getByRole('button', { name: /^How to do / })
  await expect(triggers).toHaveCount(await items.count())

  await triggers.first().click()
  await expect(panel.getByRole('tooltip')).toBeVisible()
  await expect(panel.getByRole('tooltip')).toContainText('Proper technique')
})

test.describe('touch', () => {
  test.use({ hasTouch: true, isMobile: true })

  test('tapping the trigger toggles the cues', async ({ page, request }) => {
    const user = await registerViaApi(request, 'tech-touch')
    const bench = await exerciseId(request, user, 'Barbell Bench Press')
    await startFreeForm(page, request, user)

    await page.getByLabel('Exercise').selectOption(bench)
    const button = page.getByRole('button', { name: 'How to do Barbell Bench Press' })
    await button.tap()
    await expect(page.getByRole('tooltip')).toBeVisible()
    await button.tap()
    await expect(page.getByRole('tooltip')).toHaveCount(0)
  })
})
