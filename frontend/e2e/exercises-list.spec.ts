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

async function seedCustom(request: APIRequestContext, user: ApiUser, name: string) {
  const response = await request.post(`${API}/api/exercises`, {
    ...auth(user),
    data: { name, primaryMuscleGroup: 'BICEPS', secondaryMuscleGroups: ['CORE'] },
  })
  expect(response.ok()).toBe(true)
}

function row(page: Page, name: string) {
  return page.getByRole('listitem').filter({ hasText: name })
}

async function openList(page: Page, user: ApiUser) {
  await login(page, user)
  await page.goto('/exercises')
  await expect(page.getByRole('heading', { name: 'Exercises' })).toBeVisible()
}

test('the list shows built-in and custom exercises, with a Custom tag on the custom one', async ({ page, request }) => {
  const user = await registerViaApi(request, 'exlist-tag')
  const name = `Cable Curl ${Date.now()}`
  await seedCustom(request, user, name)
  await openList(page, user)

  await expect(row(page, 'Barbell Bench Press')).toBeVisible()
  await expect(row(page, 'Barbell Bench Press').getByText('Custom', { exact: true })).toHaveCount(0)
  await expect(row(page, name)).toBeVisible()
  await expect(row(page, name).getByText('Custom', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: `Edit ${name}` })).toBeVisible()
  await expect(row(page, 'Barbell Bench Press').getByRole('link', { name: /^Edit/ })).toHaveCount(0)
  await expect(row(page, 'Barbell Bench Press').getByRole('button', { name: /^Delete/ })).toHaveCount(0)
})

test('Mine hides built-in exercises and the muscle filter matches primary or secondary groups', async ({
  page,
  request,
}) => {
  const user = await registerViaApi(request, 'exlist-filter')
  const name = `Cable Curl ${Date.now()}`
  await seedCustom(request, user, name)
  await openList(page, user)

  await page.getByRole('button', { name: 'Mine', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Mine', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(row(page, name)).toBeVisible()
  await expect(row(page, 'Barbell Bench Press')).toHaveCount(0)

  // Secondary match: the custom exercise has CORE as a secondary group.
  await page.getByLabel('Muscle group').selectOption('CORE')
  await expect(row(page, name)).toBeVisible()
  // Primary match.
  await page.getByLabel('Muscle group').selectOption('BICEPS')
  await expect(row(page, name)).toBeVisible()

  // No match -> message and clear filters.
  await page.getByLabel('Muscle group').selectOption('CALVES')
  await expect(page.getByText('No exercises match these filters.')).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(page.getByText('No exercises match these filters.')).toHaveCount(0)
  await expect(row(page, name)).toBeVisible()
  await expect(row(page, 'Barbell Bench Press')).toBeVisible()
  await expect(page.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true')

  // The muscle filter alone also hides non-matching built-ins.
  await page.getByLabel('Muscle group').selectOption('BICEPS')
  await expect(row(page, 'Barbell Bench Press')).toHaveCount(0)
})

test('an exercise can be added, edited and deleted from the list', async ({ page, request }) => {
  const user = await registerViaApi(request, 'exlist-crud')
  const name = `Zottman Curl ${Date.now()}`
  const renamed = `${name} edited`
  await openList(page, user)

  await page.getByRole('link', { name: 'Add exercise' }).click()
  await expect(page).toHaveURL(/\/exercises\/new$/)
  await page.getByLabel('Name').fill(name)
  await page.getByLabel('Primary muscle group').selectOption('BICEPS')
  await page.getByLabel('Core').check()
  await page.getByRole('button', { name: 'Add exercise' }).click()

  await expect(page).toHaveURL(/\/exercises$/)
  await expect(row(page, name)).toBeVisible()
  await expect(row(page, name).getByText('Custom', { exact: true })).toBeVisible()

  await page.getByRole('link', { name: `Edit ${name}` }).click()
  await expect(page).toHaveURL(/\/exercises\/[^/]+\/edit$/)
  await expect(page.getByLabel('Name')).toHaveValue(name)
  await page.getByLabel('Name').fill(renamed)
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page).toHaveURL(/\/exercises$/)
  await expect(row(page, renamed)).toBeVisible()

  // Cancel keeps the exercise.
  await page.getByRole('button', { name: `Delete ${renamed}` }).click()
  await row(page, renamed).getByRole('button', { name: 'Cancel' }).click()
  await expect(row(page, renamed)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirm' })).toHaveCount(0)

  // Confirm removes it.
  await page.getByRole('button', { name: `Delete ${renamed}` }).click()
  await row(page, renamed).getByRole('button', { name: 'Confirm' }).click()
  await expect(row(page, renamed)).toHaveCount(0)
})

test('the edit URL of a built-in or unknown exercise shows the not-found state', async ({ page, request }) => {
  const user = await registerViaApi(request, 'exlist-notfound')
  const builtIn = await exerciseId(request, user, 'Barbell Bench Press')
  await login(page, user)

  await page.goto(`/exercises/${builtIn}/edit`)
  await expect(page.getByText('Exercise not found')).toBeVisible()
  await expect(page.getByLabel('Name')).toHaveCount(0)

  await page.goto('/exercises/00000000-0000-0000-0000-000000000000/edit')
  await expect(page.getByText('Exercise not found')).toBeVisible()
  await page.getByRole('link', { name: 'Back to exercises' }).click()
  await expect(page).toHaveURL(/\/exercises$/)
})
