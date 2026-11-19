import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import { API, PASSWORD, auth, exerciseId, registerViaApi } from './helpers.js'
import type { ApiUser } from './helpers.js'

async function login(page: Page, user: ApiUser) {
  // Only seeds English when no language is stored yet, so a later switch to Polish survives reloads.
  await page.addInitScript(() => {
    if (!localStorage.getItem('gymtrack.lang')) localStorage.setItem('gymtrack.lang', 'en')
  })
  await page.goto('/login')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
}

async function seedCustom(request: APIRequestContext, user: ApiUser, name: string) {
  const response = await request.post(`${API}/api/exercises`, {
    ...auth(user),
    data: { name, primaryMuscleGroup: 'BICEPS', secondaryMuscleGroups: ['ABS'] },
  })
  expect(response.ok()).toBe(true)
}

function row(page: Page, name: string) {
  return page.getByRole('listitem').filter({ hasText: name })
}

function star(page: Page, name: string, lang: 'en' | 'pl' = 'en') {
  return page.getByRole('button', {
    name: lang === 'pl' ? `Ulubione: ${name}` : `Favourite ${name}`,
    exact: true,
  })
}

/** The list shows 10 exercises per page, so a test that needs a specific row passes its name as `search`. */
async function openList(page: Page, user: ApiUser, lang: 'en' | 'pl' = 'en', search?: string) {
  await login(page, user)
  if (lang === 'pl') await page.evaluate(() => localStorage.setItem('gymtrack.lang', 'pl'))
  await page.goto('/exercises')
  await expect(page.getByRole('heading', { name: lang === 'pl' ? 'Ćwiczenia' : 'Exercises' })).toBeVisible()
  if (search) await page.getByLabel(lang === 'pl' ? 'Szukaj ćwiczeń' : 'Search exercises').fill(search)
}

test('a built-in and a custom exercise can be starred and stay starred after a reload', async ({ page, request }) => {
  const user = await registerViaApi(request, 'exfav-persist')
  const name = `Star Curl ${Date.now()}`
  await seedCustom(request, user, name)
  await openList(page, user)

  await expect(star(page, 'Barbell Bench Press')).toHaveAttribute('aria-pressed', 'false')
  await star(page, 'Barbell Bench Press').click()
  await expect(star(page, 'Barbell Bench Press')).toHaveAttribute('aria-pressed', 'true')
  // The custom row is on a later page of the alphabetical list: find it with the search box.
  await page.getByLabel('Search exercises').fill(name)
  await star(page, name).click()
  await expect(star(page, name)).toHaveAttribute('aria-pressed', 'true')

  await page.reload()
  await expect(star(page, 'Barbell Bench Press')).toHaveAttribute('aria-pressed', 'true')
  await expect(star(page, 'Barbell Row')).toHaveAttribute('aria-pressed', 'false')
  // The star does not turn built-in rows into editable ones.
  await expect(row(page, 'Barbell Bench Press').getByRole('link', { name: /^Edit/ })).toHaveCount(0)
  await page.getByLabel('Search exercises').fill(name)
  await expect(star(page, name)).toHaveAttribute('aria-pressed', 'true')
})

test('Favourites lists only starred exercises; un-starring there removes the row and focuses the heading', async ({
  page,
  request,
}) => {
  const user = await registerViaApi(request, 'exfav-scope')
  await openList(page, user)

  await page.getByRole('button', { name: 'Favourites', exact: true }).click()
  await expect(page.getByText('No favourite exercises yet.')).toBeVisible()

  await page.getByRole('button', { name: 'All', exact: true }).click()
  await star(page, 'Barbell Bench Press').click()
  await expect(star(page, 'Barbell Bench Press')).toHaveAttribute('aria-pressed', 'true')
  await star(page, 'Barbell Row').click()
  await expect(star(page, 'Barbell Row')).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: 'Favourites', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Favourites', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.plan-list .plan-item')).toHaveCount(2)
  await expect(row(page, 'Barbell Bench Press')).toBeVisible()
  await expect(row(page, 'Barbell Row')).toBeVisible()

  await star(page, 'Barbell Row').click()
  await expect(row(page, 'Barbell Row')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Exercises', exact: true })).toBeFocused()

  await star(page, 'Barbell Bench Press').click()
  await expect(page.getByText('No favourite exercises yet.')).toBeVisible()
})

test('search narrows the list ignoring case and accents, combines with other filters and is cleared by Clear filters', async ({
  page,
  request,
}) => {
  const user = await registerViaApi(request, 'exfav-search')
  const name = `Żuraw Curl ${Date.now()}`
  await seedCustom(request, user, name)
  await openList(page, user)

  const search = page.getByLabel('Search exercises')
  await search.fill('BENCH PRESS')
  await expect(row(page, 'Barbell Bench Press')).toBeVisible()
  await expect(row(page, 'Barbell Row')).toHaveCount(0)

  await search.fill('  bench  ')
  await expect(row(page, 'Barbell Bench Press')).toBeVisible()

  // Accent-insensitive: "zuraw" finds "Żuraw …"; Mine keeps the custom one and drops built-ins.
  await search.fill('zuraw')
  await expect(row(page, name)).toBeVisible()
  await expect(page.locator('.plan-list .plan-item')).toHaveCount(1)
  await page.getByRole('button', { name: 'Mine', exact: true }).click()
  await expect(row(page, name)).toBeVisible()

  // Search and scope together can match nothing.
  await search.fill('bench')
  await expect(page.getByText('No exercises match these filters.')).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(search).toHaveValue('')
  await expect(page.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(row(page, 'Barbell Bench Press')).toBeVisible()
  // The full list is back, so it is paged again.
  await expect(page.getByRole('navigation', { name: 'Exercise pages' })).toBeVisible()

  // Search combines with the muscle filter.
  await page.getByLabel('Muscle group').selectOption('BICEPS')
  await search.fill('bench')
  await expect(page.getByText('No exercises match these filters.')).toBeVisible()
})

test('in Polish a translated built-in name is found when typed without diacritics', async ({ page, request }) => {
  const user = await registerViaApi(request, 'exfav-pl')
  await openList(page, user, 'pl')

  await page.getByLabel('Szukaj ćwiczeń').fill('lawce skosnej')
  await expect(row(page, 'Wyciskanie hantli na ławce skośnej')).toBeVisible()
  await expect(page.locator('.plan-list .plan-item')).toHaveCount(1)

  await star(page, 'Wyciskanie hantli na ławce skośnej', 'pl').click()
  await expect(star(page, 'Wyciskanie hantli na ławce skośnej', 'pl')).toHaveAttribute('aria-pressed', 'true')
})

test("one user's stars are not visible to another user", async ({ page, request }) => {
  const first = await registerViaApi(request, 'exfav-iso-a')
  const second = await registerViaApi(request, 'exfav-iso-b')
  await openList(page, first)
  await star(page, 'Barbell Bench Press').click()
  await expect(star(page, 'Barbell Bench Press')).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(star(page, 'Barbell Bench Press')).toHaveAttribute('aria-pressed', 'true')

  await page.evaluate(() => localStorage.clear())
  await page.context().clearCookies()
  await openList(page, second)
  await expect(star(page, 'Barbell Bench Press')).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: 'Favourites', exact: true }).click()
  await expect(page.getByText('No favourite exercises yet.')).toBeVisible()
})

test('a failed toggle rolls the star back and shows an alert', async ({ page, request }) => {
  const user = await registerViaApi(request, 'exfav-fail')
  await openList(page, user)

  await page.route('**/api/exercises/*/favorite', (route) => route.fulfill({ status: 500, body: '{}' }))
  await star(page, 'Barbell Bench Press').click()

  await expect(page.getByRole('alert')).toBeVisible()
  await expect(star(page, 'Barbell Bench Press')).toHaveAttribute('aria-pressed', 'false')
  await expect(star(page, 'Barbell Bench Press')).toBeEnabled()
})

test('on a phone the star, Edit and Delete stay on the right of every row', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  const user = await registerViaApi(request, 'exfav-rows')
  const names = [`Leg curl`, `Bardzo długa nazwa własnego ćwiczenia na plecy z dodatkami`]
  for (const name of names) await seedCustom(request, user, name)
  await openList(page, user)
  await page.getByRole('button', { name: 'Mine', exact: true }).click()

  const rows = page.locator('.plan-list .plan-item')
  await expect(rows).toHaveCount(2)
  for (let i = 0; i < 2; i++) {
    const info = (await rows.nth(i).locator('.plan-item-info').boundingBox())!
    const actions = (await rows.nth(i).locator('.plan-item-actions').boundingBox())!
    expect(actions.x).toBeGreaterThanOrEqual(info.x + info.width - 1)
    expect(actions.y).toBeLessThan(info.y + info.height)
    expect(actions.x + actions.width).toBeLessThanOrEqual(390)
  }
  const box = (await rows.nth(0).getByRole('button', { name: /^Favourite/ }).boundingBox())!
  expect(box.width).toBeGreaterThanOrEqual(44)
  expect(box.height).toBeGreaterThanOrEqual(44)
})

async function starViaApi(request: APIRequestContext, user: ApiUser, name: string) {
  const id = await exerciseId(request, user, name)
  const response = await request.put(`${API}/api/exercises/${id}/favorite`, auth(user))
  expect(response.ok()).toBe(true)
  return id
}

async function openWorkoutPicker(page: Page, user: ApiUser, lang: 'en' | 'pl' = 'en') {
  await login(page, user)
  if (lang === 'pl') await page.evaluate(() => localStorage.setItem('gymtrack.lang', 'pl'))
  await page.goto('/workout')
  // Let the page's initial loads settle first: a late "current session" response would otherwise
  // overwrite a workout started by the click below (seen under load in the full suite).
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: lang === 'pl' ? 'Rozpocznij trening' : 'Start workout' }).click()
  await expect(page.locator('#exercise-select')).toBeVisible()
}

const BENCH = 'Barbell Bench Press — Mid chest'

test('workout picker: typing narrows the options and the selection survives clearing the search', async ({
  page,
  request,
}) => {
  const user = await registerViaApi(request, 'expick-search')
  await openWorkoutPicker(page, user)

  const select = page.locator('#exercise-select')
  const search = page.locator('#exercise-search')
  await expect(search).toBeVisible()
  const total = await select.locator('option').count()

  await search.fill('BENCH')
  await expect(select.locator('option', { hasText: 'Barbell Row' })).toHaveCount(0)
  await expect(select.locator('option', { hasText: 'Barbell Bench Press' })).toHaveCount(1)
  expect(await select.locator('option').count()).toBeLessThan(total)

  await select.selectOption({ label: BENCH })
  await search.fill('')
  await expect(select.locator('option')).toHaveCount(total)
  await expect(select.locator('option:checked')).toHaveText(BENCH)

  // A selection that no longer matches the search stays in the list.
  await search.fill('row')
  await expect(select.locator('option:checked')).toHaveText(BENCH)

  await search.fill('zzzzzz')
  await expect(page.getByText('No exercises match your search.')).toBeVisible()
  await expect(select.locator('option:checked')).toHaveText(BENCH)
  await expect(select.locator('option')).toHaveCount(2) // placeholder + kept selection
})

test('workout picker in Polish finds a translated name typed without diacritics', async ({ page, request }) => {
  const user = await registerViaApi(request, 'expick-pl')
  await openWorkoutPicker(page, user, 'pl')

  await page.locator('#exercise-search').fill('lawce skosnej')
  const options = page.locator('#exercise-select option', { hasText: 'Wyciskanie hantli na ławce skośnej' })
  await expect(options).toHaveCount(1)
  await expect(page.locator('#exercise-select option', { hasText: 'Przysiad' })).toHaveCount(0)
})

test('workout picker: starred exercises are grouped first and listed once; no favourites means a flat list', async ({
  page,
  request,
}) => {
  const user = await registerViaApi(request, 'expick-groups')
  await openWorkoutPicker(page, user)
  const select = page.locator('#exercise-select')

  await expect(select.locator('optgroup')).toHaveCount(0)

  await starViaApi(request, user, 'Barbell Row')
  await page.reload()
  await expect(select).toBeVisible()

  const groups = select.locator('optgroup')
  await expect(groups).toHaveCount(2)
  await expect(groups.nth(0)).toHaveAttribute('label', 'Favourites')
  await expect(groups.nth(1)).toHaveAttribute('label', 'Other exercises')
  await expect(groups.nth(0).locator('option')).toHaveText(['Barbell Row — Lats'])
  await expect(select.locator('option', { hasText: 'Barbell Row' })).toHaveCount(1)

  // With only favourites matching, the other group disappears.
  await page.locator('#exercise-search').fill('barbell row')
  await expect(select.locator('optgroup')).toHaveCount(1)
})

test('plan editor picker filters and the chosen exercise can still be added to the plan', async ({ page, request }) => {
  const user = await registerViaApi(request, 'expick-plan')
  await starViaApi(request, user, 'Barbell Bench Press')
  await login(page, user)
  await page.goto('/plans/new')

  const select = page.locator('#exercise-select')
  await expect(select.locator('optgroup').first()).toHaveAttribute('label', 'Favourites')

  await page.locator('#exercise-search').fill('bench')
  await expect(select.locator('option', { hasText: 'Barbell Row' })).toHaveCount(0)
  await select.selectOption({ label: BENCH })
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await page.locator('#exercise-search').fill('')
  await expect(select.locator('option:checked')).toHaveText(BENCH)

  await page.getByLabel('Plan name').fill(`Picker plan ${Date.now()}`)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page).toHaveURL(/\/plans$/)
})
