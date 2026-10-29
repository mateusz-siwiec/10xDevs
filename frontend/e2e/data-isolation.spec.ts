import { expect, test } from '@playwright/test'
import { API, auth, exerciseId, registerViaApi, uniqueEmail, PASSWORD } from './helpers.js'

// Test plan risk R1: one user must never see another user's training data.
test("a second user cannot see or reach the first user's plan and custom exercise", async ({ page, request }) => {
  const owner = await registerViaApi(request, 'owner')
  const bench = await exerciseId(request, owner, 'Barbell Bench Press')
  const planName = `Owner plan ${Date.now()}`
  const customName = `Owner exercise ${Date.now()}`

  const plan = await request.post(`${API}/api/training-plans`, {
    ...auth(owner),
    data: { name: planName, entries: [{ exerciseId: bench, sets: 3, reps: 8 }] },
  })
  expect(plan.status()).toBe(201)
  const planId = (await plan.json()).id
  const custom = await request.post(`${API}/api/exercises`, {
    ...auth(owner),
    data: { name: customName, primaryMuscleGroup: 'CHEST', secondaryMuscleGroups: [] },
  })
  expect(custom.status()).toBe(201)

  // A different user registers through the UI and browses the app.
  await page.addInitScript(() => localStorage.setItem('gymtrack.lang', 'en'))
  await page.goto('/register')
  await page.getByLabel('Email').fill(uniqueEmail('intruder'))
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Register', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  await page.getByRole('link', { name: 'Plans' }).click()
  await expect(page.getByText('You have no plans yet')).toBeVisible()
  await expect(page.getByText(planName)).toHaveCount(0)

  await page.getByRole('link', { name: 'Exercises' }).click()
  await expect(page.getByText(customName)).toHaveCount(0)

  // Guessing the owner's plan id directly is also refused.
  const intruder = await registerViaApi(request, 'intruder-api')
  const direct = await request.get(`${API}/api/training-plans/${planId}`, auth(intruder))
  expect(direct.status()).toBe(404)
})
