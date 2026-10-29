import { expect, test } from '@playwright/test'

test('register, log a set in a workout, and see it in history', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gymtrack.lang', 'en')
  })

  // Register a brand new user.
  await page.goto('/register')
  await page.getByLabel('Email').fill(`e2e-${Date.now()}@example.com`)
  await page.getByLabel('Password').fill('Passw0rd-e2e!')
  await page.getByRole('button', { name: 'Register', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  // Start a free-form workout.
  await page.goto('/workout')
  await page.getByRole('button', { name: 'Start workout' }).click()

  // Log one set on a preloaded exercise.
  await page.getByLabel('Exercise').selectOption({ label: 'Barbell Bench Press' })
  await page.getByLabel('Reps').fill('8')
  await page.getByLabel('Weight (kg)').fill('60')
  await page.getByRole('button', { name: 'Log set' }).click()

  const sessionSets = page.getByRole('list').filter({ hasText: 'Barbell Bench Press' })
  await expect(sessionSets.getByText('8 × 60 kg')).toBeVisible()

  // End the session.
  await page.getByRole('button', { name: 'End workout' }).click()
  await expect(page.getByRole('button', { name: 'Start workout' })).toBeVisible()

  // The set shows up in history.
  await page.getByRole('link', { name: 'History' }).click()
  await page.locator('a.history-row').first().click()
  await expect(page.getByRole('heading', { name: 'Barbell Bench Press' })).toBeVisible()
  await expect(page.getByText('Set 1: 8 × 60 kg')).toBeVisible()
})
