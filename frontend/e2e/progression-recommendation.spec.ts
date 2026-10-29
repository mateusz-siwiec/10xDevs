import { expect, test } from '@playwright/test'
import { API, PASSWORD, auth, exerciseId, registerViaApi } from './helpers.js'

// Test plan risk R2: the weight-increase suggestion must follow the documented rule.
test('after two full workouts at 60 kg the workout screen suggests 61.5 kg', async ({ page, request }) => {
  const user = await registerViaApi(request, 'progress')
  const bench = await exerciseId(request, user, 'Barbell Bench Press')
  const plan = await request.post(`${API}/api/training-plans`, {
    ...auth(user),
    data: { name: 'Push day', entries: [{ exerciseId: bench, sets: 3, reps: 8 }] },
  })
  const planId = (await plan.json()).id

  // Two ended workouts from the plan, each with 3 sets of 8 reps at 60 kg.
  for (let workout = 0; workout < 2; workout++) {
    const session = await request.post(`${API}/api/workout-sessions`, { ...auth(user), data: { planId } })
    const sessionId = (await session.json()).id
    for (let set = 0; set < 3; set++) {
      const logged = await request.post(`${API}/api/workout-sessions/${sessionId}/sets`, {
        ...auth(user),
        data: { exerciseId: bench, reps: 8, weightKg: 60 },
      })
      expect(logged.status()).toBe(201)
    }
    const ended = await request.post(`${API}/api/workout-sessions/${sessionId}/end`, auth(user))
    expect(ended.status()).toBe(200)
  }

  await page.addInitScript(() => localStorage.setItem('gymtrack.lang', 'en'))
  await page.goto('/login')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  await page.goto('/workout')
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByLabel('Exercise').selectOption({ label: 'Barbell Bench Press' })

  await expect(page.getByText('Try 61.5 kg — you completed 3×8 at 60 kg in your last 2 workouts.')).toBeVisible()
})
