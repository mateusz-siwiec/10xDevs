import { expect, test } from '@playwright/test'
import { API, PASSWORD, auth, exerciseId, registerViaApi } from './helpers.js'

const BADGE = 'Set taken to failure'

// Failure flag round trip: log with the checkbox, then read it back in history and the previous-workout hint.
test('a set logged to failure is marked in the workout, in history and in the next workout hint', async ({
  page,
  request,
}) => {
  const user = await registerViaApi(request, 'failure')
  const bench = await exerciseId(request, user, 'Barbell Bench Press')
  await request.post(`${API}/api/training-plans`, {
    ...auth(user),
    data: { name: 'Push day', entries: [{ exerciseId: bench, sets: 3, reps: 8 }] },
  })

  await page.addInitScript(() => localStorage.setItem('gymtrack.lang', 'en'))
  await page.goto('/login')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  // Start the workout from the plan.
  await page.goto('/workout')
  // The plan row has its own Start button.
  await page.getByRole('button', { name: 'Start plan Push day' }).click()
  await page.getByLabel('Exercise').selectOption({ label: 'Barbell Bench Press — Mid chest' })

  // First set with "To failure" ticked, second without.
  const toFailure = page.getByRole('checkbox', { name: 'To failure' })
  await page.getByLabel('Reps').fill('8')
  await page.getByLabel('Weight (kg)').fill('60')
  await toFailure.check()
  await page.getByRole('button', { name: 'Log set' }).click()
  await expect(page.locator('.set-list li')).toHaveCount(1)
  await expect(toFailure).not.toBeChecked()
  await page.getByLabel('Reps').fill('7')
  await page.getByRole('button', { name: 'Log set' }).click()

  const items = page.locator('.set-list li')
  await expect(items).toHaveCount(2)
  await expect(items.nth(0).getByRole('img', { name: BADGE })).toBeVisible()
  await expect(items.nth(1).getByRole('img', { name: BADGE })).toHaveCount(0)
  await expect(toFailure).not.toBeChecked()

  await page.getByRole('button', { name: 'End workout' }).click()
  await page.getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByRole('button', { name: 'Start workout' })).toBeVisible()

  // History detail marks the same set.
  await page.getByRole('link', { name: 'History' }).click()
  await page.locator('a.history-row').first().click()
  const first = page.getByRole('listitem').filter({ hasText: 'Set 1: 8 × 60 kg' })
  const second = page.getByRole('listitem').filter({ hasText: 'Set 2: 7 × 60 kg' })
  await expect(first.getByRole('img', { name: BADGE })).toBeVisible()
  await expect(second.getByRole('img', { name: BADGE })).toHaveCount(0)

  // The next workout from the same plan shows the marker in the "last time" hint.
  await page.goto('/workout')
  // The plan row has its own Start button.
  await page.getByRole('button', { name: 'Start plan Push day' }).click()
  await page.getByLabel('Exercise').selectOption({ label: 'Barbell Bench Press — Mid chest' })
  const hint = page.locator('.previous-workout-hint')
  await expect(hint).toContainText('Set 1: 8 × 60 kg')
  await expect(hint.locator('li').nth(0).getByRole('img', { name: BADGE })).toBeVisible()
  await expect(hint.locator('li').nth(1).getByRole('img', { name: BADGE })).toHaveCount(0)
})

test('a set logged through the API without toFailure shows no badge', async ({ page, request }) => {
  const user = await registerViaApi(request, 'failure-old')
  const bench = await exerciseId(request, user, 'Barbell Bench Press')
  const session = await request.post(`${API}/api/workout-sessions`, auth(user))
  const sessionId = (await session.json()).id
  const logged = await request.post(`${API}/api/workout-sessions/${sessionId}/sets`, {
    ...auth(user),
    data: { exerciseId: bench, reps: 8, weightKg: 60 },
  })
  expect(logged.status()).toBe(201)
  expect((await logged.json()).toFailure).toBe(false)

  await page.addInitScript(() => localStorage.setItem('gymtrack.lang', 'en'))
  await page.goto('/login')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  await page.goto('/workout')
  await expect(page.locator('.set-list').getByText('8 × 60 kg')).toBeVisible()
  await expect(page.getByRole('img', { name: BADGE })).toHaveCount(0)

  await request.post(`${API}/api/workout-sessions/${sessionId}/end`, auth(user))
  await page.goto('/history')
  await page.locator('a.history-row').first().click()
  await expect(page.getByText('Set 1: 8 × 60 kg')).toBeVisible()
  await expect(page.getByRole('img', { name: BADGE })).toHaveCount(0)
})
