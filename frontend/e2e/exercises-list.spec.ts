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

async function openList(page: Page, user: ApiUser, lang: 'en' | 'pl' = 'en') {
  await login(page, user)
  if (lang === 'pl') await page.evaluate(() => localStorage.setItem('gymtrack.lang', 'pl'))
  await page.goto('/exercises')
  await expect(page.getByRole('heading', { name: lang === 'pl' ? 'Ćwiczenia' : 'Exercises' })).toBeVisible()
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

  // Secondary match: the custom exercise has ABS as a secondary group.
  await page.getByLabel('Muscle group').selectOption('ABS')
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

  await page.getByRole('button', { name: 'Exercises', exact: true }).click()
  await page.getByRole('link', { name: 'New exercise', exact: true }).click()
  await expect(page).toHaveURL(/\/exercises\/new$/)
  await page.getByLabel('Name').fill(name)
  await page.getByLabel('Primary muscle group').selectOption('BICEPS')
  await page.getByLabel('Abs').check()
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

test('the top-bar Exercises menu opens the list and the add form and closes on Escape or outside click', async ({
  page,
  request,
}) => {
  const user = await registerViaApi(request, 'exmenu')
  await page.addInitScript(() => localStorage.setItem('gymtrack.lang', 'en'))
  await page.goto('/login')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  const button = page.getByRole('button', { name: 'Exercises', exact: true })
  const list = page.getByRole('link', { name: 'Exercises', exact: true })
  const add = page.getByRole('link', { name: 'New exercise', exact: true })
  await expect(button).toHaveAttribute('aria-expanded', 'false')
  await button.click()
  await expect(button).toHaveAttribute('aria-expanded', 'true')
  await expect(list).toBeVisible()
  await expect(add).toBeVisible()

  // Arrow keys move between the items; Escape closes the menu and returns focus to the button.
  await page.keyboard.press('ArrowDown')
  await expect(list).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(add).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(add).toHaveCount(0)
  await expect(button).toBeFocused()

  // Clicking elsewhere closes it too.
  await button.click()
  await expect(add).toBeVisible()
  await page.getByRole('heading', { name: 'Dashboard' }).click()
  await expect(add).toHaveCount(0)

  // The list has the All / Mine filter and no Add button; the add form is its own page.
  await button.click()
  await list.click()
  await expect(page).toHaveURL(/\/exercises$/)
  await expect(page.getByRole('button', { name: 'Mine', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Add exercise' })).toHaveCount(0)

  await button.click()
  await add.click()
  await expect(page).toHaveURL(/\/exercises\/new$/)
  await expect(page.getByRole('heading', { name: 'Add exercise' })).toBeVisible()
})

test('opening New exercise after editing one starts with an empty form', async ({ page, request }) => {
  const user = await registerViaApi(request, 'exlist-carry')
  const name = `Carry Curl ${Date.now()}`
  await seedCustom(request, user, name)
  await openList(page, user)

  await page.getByRole('link', { name: `Edit ${name}` }).click()
  await expect(page.getByLabel('Name')).toHaveValue(name)

  await page.getByRole('button', { name: 'Exercises', exact: true }).click()
  await page.getByRole('link', { name: 'New exercise', exact: true }).click()
  await expect(page).toHaveURL(/\/exercises\/new$/)
  await expect(page.getByRole('heading', { name: 'Add exercise' })).toBeVisible()
  await expect(page.getByLabel('Name')).toHaveValue('')
  await expect(page.getByLabel('Primary muscle group')).toHaveValue('')
})

test('an exercise used in a plan cannot be deleted: an error is shown and the row stays', async ({ page, request }) => {
  const user = await registerViaApi(request, 'exlist-inuse')
  const name = `Used Curl ${Date.now()}`
  await seedCustom(request, user, name)
  const exercises: { id: string; name: string }[] = await (await request.get(`${API}/api/exercises`, auth(user))).json()
  const custom = exercises.find((e) => e.name === name)!
  const plan = await request.post(`${API}/api/training-plans`, {
    ...auth(user),
    data: { name: 'Uses custom', entries: [{ exerciseId: custom.id, sets: 3, reps: 8 }] },
  })
  expect(plan.status()).toBe(201)
  await openList(page, user)

  await page.getByRole('button', { name: `Delete ${name}` }).click()
  await page.getByRole('button', { name: 'Confirm' }).click()

  await expect(page.getByRole('alert')).toContainText('cannot be deleted')
  await expect(row(page, name)).toBeVisible()
  // The confirmation closed and focus returned to the row's Delete button.
  await expect(page.getByRole('button', { name: 'Confirm' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: `Delete ${name}` })).toBeFocused()
})

test('Cancel on a delete confirmation returns focus to that row, and a successful delete focuses the heading', async ({
  page,
  request,
}) => {
  const user = await registerViaApi(request, 'exlist-focus')
  const name = `Focus Curl ${Date.now()}`
  await seedCustom(request, user, name)
  await openList(page, user)

  await page.getByRole('button', { name: `Delete ${name}` }).click()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('button', { name: `Delete ${name}` })).toBeFocused()

  await page.getByRole('button', { name: `Delete ${name}` }).click()
  await page.getByRole('button', { name: 'Confirm' }).click()
  await expect(row(page, name)).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Exercises', exact: true })).toBeFocused()
})

test('while one delete is in flight the other rows cannot start a delete', async ({ page, request }) => {
  const user = await registerViaApi(request, 'exlist-busy')
  const first = `Busy Curl A ${Date.now()}`
  const second = `Busy Curl B ${Date.now()}`
  await seedCustom(request, user, first)
  await seedCustom(request, user, second)
  await openList(page, user)

  let release!: () => void
  const gate = new Promise<void>((resolve) => (release = resolve))
  await page.route('**/api/exercises/*', async (route) => {
    if (route.request().method() !== 'DELETE') return route.continue()
    await gate
    return route.continue()
  })

  await page.getByRole('button', { name: `Delete ${first}` }).click()
  await page.getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByRole('button', { name: `Delete ${second}` })).toBeDisabled()

  release()
  await expect(row(page, first)).toHaveCount(0)
  await expect(page.getByRole('button', { name: `Delete ${second}` })).toBeEnabled()
})

test('creating an exercise with a name you already use shows an error and keeps the form', async ({ page, request }) => {
  const user = await registerViaApi(request, 'exlist-taken')
  const name = `Taken Curl ${Date.now()}`
  await seedCustom(request, user, name)
  await login(page, user)
  await page.goto('/exercises/new')

  await page.getByLabel('Name').fill(name)
  await page.getByLabel('Primary muscle group').selectOption('BICEPS')
  await page.getByRole('button', { name: 'Add exercise' }).click()

  await expect(page.getByRole('alert')).toContainText('already have an exercise with this name')
  await expect(page).toHaveURL(/\/exercises\/new$/)
  await expect(page.getByLabel('Name')).toHaveValue(name)
  await expect(page.getByRole('button', { name: 'Add exercise' })).toBeEnabled()
})

test.describe('technique tooltip', () => {
  const trigger = (page: Page) =>
    row(page, 'Barbell Bench Press').getByRole('button', { name: 'How to do Barbell Bench Press' })

  test('a built-in row opens its cues on hover and on click, and a custom row has no trigger', async ({
    page,
    request,
  }) => {
    const user = await registerViaApi(request, 'extech-open')
    const name = `Tech Curl ${Date.now()}`
    await seedCustom(request, user, name)
    await openList(page, user)

    const button = trigger(page)
    const panel = row(page, 'Barbell Bench Press').getByRole('tooltip')
    await expect(button).toHaveAttribute('aria-expanded', 'false')
    await expect(panel).toHaveCount(0)

    await button.hover()
    await expect(panel).toBeVisible()
    await expect(panel).toContainText('Proper technique')
    await expect(panel).toContainText('Lie back with your eyes under the bar')
    await expect(button).toHaveAttribute('aria-expanded', 'true')

    // Moving away closes it; a click then opens it.
    await page.mouse.move(0, 0)
    await expect(panel).toHaveCount(0)
    await button.click()
    await expect(panel).toBeVisible()

    await expect(row(page, name)).toBeVisible()
    await expect(row(page, name).getByRole('button', { name: /^How to do/ })).toHaveCount(0)
  })

  test('keyboard focus opens the cues, Escape closes them and returns focus to the trigger', async ({
    page,
    request,
  }) => {
    const user = await registerViaApi(request, 'extech-key')
    await openList(page, user)

    const button = trigger(page)
    const panel = row(page, 'Barbell Bench Press').getByRole('tooltip')
    await button.focus()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    await expect(button).toBeFocused()
    await expect(panel).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
    await expect(button).toBeFocused()
    await expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  test('an outside click closes the cues', async ({ page, request }) => {
    const user = await registerViaApi(request, 'extech-outside')
    await openList(page, user)

    const panel = row(page, 'Barbell Bench Press').getByRole('tooltip')
    await trigger(page).click()
    await expect(panel).toBeVisible()
    await page.getByRole('heading', { name: 'Exercises', exact: true }).click()
    await expect(panel).toHaveCount(0)
  })

  test('in Polish the label, heading and cues are translated', async ({ page, request }) => {
    const user = await registerViaApi(request, 'extech-pl')
    await openList(page, user, 'pl')

    const button = page.getByRole('button', { name: /^Jak wykonać: / }).first()
    await expect(button).toBeVisible()
    await button.click()
    const panel = page.getByRole('tooltip')
    await expect(panel).toBeVisible()
    await expect(panel).toContainText('Poprawna technika')
    await expect(panel).not.toContainText('Proper technique')
  })
})

test('on a phone Edit and Delete stay to the right of every row, however long the name is', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  const user = await registerViaApi(request, 'exlist-rows')
  const names = [
    `Leg curl`,
    `Prostowanie ramion na wyciągu z linką`,
    `Bardzo długa nazwa własnego ćwiczenia na plecy z dodatkami`,
  ]
  for (const name of names) await seedCustom(request, user, name)
  await openList(page, user)
  await page.getByRole('button', { name: 'Mine', exact: true }).click()

  const rows = page.locator('.plan-list .plan-item')
  await expect(rows).toHaveCount(3)
  for (let i = 0; i < 3; i++) {
    const info = (await rows.nth(i).locator('.plan-item-info').boundingBox())!
    const actions = (await rows.nth(i).locator('.plan-item-actions').boundingBox())!
    // The buttons start where the text column ends (same line), never below it.
    expect(actions.x).toBeGreaterThanOrEqual(info.x + info.width - 1)
    expect(actions.y).toBeLessThan(info.y + info.height)
  }
})
