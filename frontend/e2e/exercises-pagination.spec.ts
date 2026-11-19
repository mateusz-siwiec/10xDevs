import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import { API, PASSWORD, auth, registerViaApi } from './helpers.js'
import type { ApiUser } from './helpers.js'

const PAGE_SIZE = 10

async function openList(page: Page, user: ApiUser, lang: 'en' | 'pl' = 'en') {
  await page.addInitScript((l) => localStorage.setItem('gymtrack.lang', l), lang)
  await page.goto('/login')
  await page.getByLabel(lang === 'pl' ? 'E-mail' : 'Email').fill(user.email)
  await page.getByLabel(lang === 'pl' ? 'Hasło' : 'Password').fill(PASSWORD)
  await page.getByRole('button', { name: lang === 'pl' ? 'Zaloguj się' : 'Log in', exact: true }).click()
  // Leave /login before navigating, otherwise the pending login request is aborted.
  await expect(page).not.toHaveURL(/\/login/)
  await page.goto('/exercises')
  await expect(page.locator('.exercise-list .plan-item').first()).toBeVisible()
}

async function exerciseCount(request: APIRequestContext, user: ApiUser) {
  const list: unknown[] = await (await request.get(`${API}/api/exercises`, auth(user))).json()
  return list.length
}

async function seedCustom(request: APIRequestContext, user: ApiUser, name: string) {
  const response = await request.post(`${API}/api/exercises`, {
    ...auth(user),
    data: { name, primaryMuscleGroup: 'BICEPS', secondaryMuscleGroups: [] },
  })
  expect(response.ok()).toBe(true)
}

const rows = (page: Page) => page.locator('.exercise-list .plan-item')
const pager = (page: Page, name = 'Exercise pages') => page.getByRole('navigation', { name })
const prev = (page: Page, name = 'Previous', nav = 'Exercise pages') => pager(page, nav).getByRole('button', { name, exact: true })
const next = (page: Page, name = 'Next', nav = 'Exercise pages') => pager(page, nav).getByRole('button', { name, exact: true })

test('the list shows 10 exercises per page and Previous / Next move through the alphabetical pages', async ({
  page,
  request,
}) => {
  const user = await registerViaApi(request, 'expage-basic')
  const pages = Math.ceil((await exerciseCount(request, user)) / PAGE_SIZE)
  expect(pages).toBeGreaterThan(1)
  await openList(page, user)

  await expect(rows(page)).toHaveCount(PAGE_SIZE)
  await expect(pager(page).getByText(`Page 1 of ${pages}`)).toBeVisible()
  await expect(prev(page)).toHaveAttribute('aria-disabled', 'true')
  await expect(next(page)).toHaveAttribute('aria-disabled', 'false')
  const firstOnPage1 = await rows(page).first().locator('.plan-item-name').innerText()

  await next(page).click()
  await expect(pager(page).getByText(`Page 2 of ${pages}`)).toBeVisible()
  await expect(prev(page)).toHaveAttribute('aria-disabled', 'false')
  await expect(rows(page)).toHaveCount(PAGE_SIZE)
  expect(await rows(page).first().locator('.plan-item-name').innerText()).not.toBe(firstOnPage1)

  await prev(page).click()
  await expect(pager(page).getByText(`Page 1 of ${pages}`)).toBeVisible()
  expect(await rows(page).first().locator('.plan-item-name').innerText()).toBe(firstOnPage1)
})

test('the last page holds the remainder, Next is inert there and keyboard focus stays on it', async ({
  page,
  request,
}) => {
  const user = await registerViaApi(request, 'expage-last')
  const total = await exerciseCount(request, user)
  const pages = Math.ceil(total / PAGE_SIZE)
  await openList(page, user)

  await next(page).focus()
  for (let i = 1; i < pages; i++) await page.keyboard.press('Enter')

  await expect(pager(page).getByText(`Page ${pages} of ${pages}`)).toBeVisible()
  await expect(rows(page)).toHaveCount(total - (pages - 1) * PAGE_SIZE)
  await expect(next(page)).toHaveAttribute('aria-disabled', 'true')
  // aria-disabled (not disabled) keeps focus where it was, so a keyboard user is not thrown to the top of the page.
  await expect(next(page)).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(pager(page).getByText(`Page ${pages} of ${pages}`)).toBeVisible()
})

test('changing the search or a filter returns to page 1, and a short result list has no pager', async ({
  page,
  request,
}) => {
  const user = await registerViaApi(request, 'expage-reset')
  await seedCustom(request, user, `Reset Curl ${Date.now()}`)
  const pages = Math.ceil((await exerciseCount(request, user)) / PAGE_SIZE)
  await openList(page, user)

  await next(page).click()
  await next(page).click()
  await expect(pager(page).getByText(`Page 3 of ${pages}`)).toBeVisible()

  // A filter that still leaves more than one page starts again on page 1.
  await page.getByLabel('Muscle group').selectOption('BICEPS')
  await expect(rows(page).first()).toBeVisible()
  const filteredPages = Math.ceil((await rows(page).count()) / PAGE_SIZE)
  expect(filteredPages).toBe(1)
  await expect(pager(page)).toHaveCount(0)

  await page.getByLabel('Muscle group').selectOption('')
  await expect(pager(page).getByText(new RegExp(`^Page 1 of ${pages}`))).toBeVisible()

  await next(page).click()
  await page.getByLabel('Search exercises').fill('curl')
  await expect(pager(page)).toHaveCount(0)
  expect(await rows(page).count()).toBeLessThanOrEqual(PAGE_SIZE)
  await page.getByLabel('Search exercises').fill('')
  await expect(pager(page).getByText(new RegExp(`^Page 1 of ${pages}`))).toBeVisible()
})

test('deleting the only row of the last page moves back to the new last page', async ({ page, request }) => {
  const user = await registerViaApi(request, 'expage-clamp')
  // Built-in exercises are 50 and a custom name starting with "Z" sorts last; make that row the only one on its page.
  const base = await exerciseCount(request, user)
  const needed = PAGE_SIZE - (base % PAGE_SIZE) + 1 // fill the last page up, then one more lands alone on a new page
  const names: string[] = []
  for (let i = 0; i < (base % PAGE_SIZE === 0 ? 1 : needed); i++) {
    const name = `Zz Clamp ${String.fromCharCode(97 + i)} ${Date.now()}`
    names.push(name)
    await seedCustom(request, user, name)
  }
  const total = await exerciseCount(request, user)
  const pages = Math.ceil(total / PAGE_SIZE)
  expect(total % PAGE_SIZE).toBe(1)
  await openList(page, user)

  for (let i = 1; i < pages; i++) await next(page).click()
  await expect(pager(page).getByText(`Page ${pages} of ${pages}`)).toBeVisible()
  await expect(rows(page)).toHaveCount(1)

  const last = names[names.length - 1]
  await page.getByRole('button', { name: `Delete ${last}` }).click()
  await page.getByRole('button', { name: 'Confirm' }).click()

  // The page count dropped by one and the view is clamped to it, not left on an empty page.
  await expect(pager(page).getByText(`Page ${pages - 1} of ${pages - 1}`)).toBeVisible()
  await expect(rows(page)).toHaveCount(PAGE_SIZE)
})

test('an open delete confirmation does not follow you to another page', async ({ page, request }) => {
  const user = await registerViaApi(request, 'expage-confirm')
  const name = `Aaa Rowhammer ${Date.now()}`
  await seedCustom(request, user, name)
  await openList(page, user)

  await page.getByRole('button', { name: `Delete ${name}` }).click()
  await expect(page.getByRole('button', { name: 'Confirm' })).toBeVisible()
  await next(page).click()
  await prev(page).click()
  await expect(page.getByRole('button', { name: 'Confirm' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: `Delete ${name}` })).toBeVisible()
})

test('in Polish the pager is translated', async ({ page, request }) => {
  const user = await registerViaApi(request, 'expage-pl')
  const pages = Math.ceil((await exerciseCount(request, user)) / PAGE_SIZE)
  await openList(page, user, 'pl')

  const nav = pager(page, 'Strony ćwiczeń')
  await expect(nav.getByText(`Strona 1 z ${pages}`)).toBeVisible()
  await expect(prev(page, 'Poprzednia', 'Strony ćwiczeń')).toHaveAttribute('aria-disabled', 'true')
  await next(page, 'Następna', 'Strony ćwiczeń').click()
  await expect(nav.getByText(`Strona 2 z ${pages}`)).toBeVisible()
})
