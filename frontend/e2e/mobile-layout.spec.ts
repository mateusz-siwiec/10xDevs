import { expect, test } from '@playwright/test'
import { API, PASSWORD, auth, registerViaApi } from './helpers.js'

// Test plan risk R12: phone layout must be consistent whatever the length of an exercise name.
test.use({ viewport: { width: 390, height: 844 } })

test('on a phone the edit and delete buttons sit under the name for short and long names alike', async ({ page, request }) => {
  const user = await registerViaApi(request, 'layout')
  for (const name of ['Dip', 'Cable crossover with a very long descriptive name']) {
    const created = await request.post(`${API}/api/exercises`, {
      ...auth(user),
      data: { name, primaryMuscleGroup: 'CHEST', secondaryMuscleGroups: [] },
    })
    expect(created.status()).toBe(201)
  }

  await page.addInitScript(() => localStorage.setItem('gymtrack.lang', 'en'))
  await page.goto('/login')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await page.goto('/exercises')

  const rows = page.locator('li.plan-item')
  await expect(rows).toHaveCount(2)
  for (let i = 0; i < 2; i++) {
    const info = await rows.nth(i).locator('.plan-item-info').boundingBox()
    const edit = await rows.nth(i).getByRole('button', { name: 'Edit' }).boundingBox()
    expect(edit!.y).toBeGreaterThanOrEqual(info!.y + info!.height)
  }
})
