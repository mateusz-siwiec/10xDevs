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

async function openList(page: Page, user: ApiUser, lang: 'en' | 'pl' = 'en') {
  await login(page, user)
  if (lang === 'pl') await page.evaluate(() => localStorage.setItem('gymtrack.lang', 'pl'))
  await page.goto('/exercises')
  await expect(page.getByRole('heading', { name: lang === 'pl' ? 'Ćwiczenia' : 'Exercises' })).toBeVisible()
}

async function startFreeForm(page: Page, request: APIRequestContext, user: ApiUser) {
  const response = await request.post(`${API}/api/workout-sessions`, auth(user))
  expect(response.status()).toBe(201)
  await login(page, user)
  await page.goto('/workout')
  await expect(page.getByLabel('Exercise')).toBeVisible()
}

function row(page: Page, name: string) {
  return page.getByRole('listitem').filter({ hasText: name })
}

test('Barbell Row highlights its primary and secondary groups and leaves the chest idle', async ({
  page,
  request,
}) => {
  const user = await registerViaApi(request, 'mmap-row')
  await openList(page, user)

  const button = row(page, 'Barbell Row').getByRole('button', { name: 'How to do Barbell Row' })
  await button.click()
  const panel = row(page, 'Barbell Row').getByRole('tooltip')
  await expect(panel).toBeVisible()
  await expect(panel).toContainText('Muscles worked')

  await expect(panel.locator('[data-muscle="LATS"][data-state="primary"]').first()).toBeVisible()
  await expect(panel.locator('[data-muscle="TRAPS"][data-state="secondary"]').first()).toBeVisible()
  await expect(panel.locator('[data-muscle="BICEPS"][data-state="secondary"]').first()).toBeVisible()
  await expect(panel.locator('[data-muscle="CHEST"][data-state="idle"]').first()).toBeVisible()
  await expect(panel.locator('[data-muscle="CHEST"][data-state="primary"]')).toHaveCount(0)
  await expect(panel.locator('[data-muscle="CHEST"][data-state="secondary"]')).toHaveCount(0)
  // A built-in exercise with cues still shows the technique list after the map.
  await expect(panel.locator('.technique-list')).toBeVisible()
})

test('a failed figure load keeps the panel, legend and cues and draws no figure', async ({ page, request }) => {
  const user = await registerViaApi(request, 'mmap-blocked')
  // Dev serves /src/components/MuscleFigure.tsx, the build a MuscleFigure-<hash>.js chunk. Registered before any
  // panel opens: the module is cached after its first successful load.
  await page.route('**/MuscleFigure*', (route) => route.abort())
  await openList(page, user)

  const item = row(page, 'Barbell Row')
  await item.getByRole('button', { name: 'How to do Barbell Row' }).click()
  const panel = item.getByRole('tooltip')
  await expect(panel).toBeVisible()
  await expect(panel).toContainText('Muscles worked')
  await expect(panel.locator('.muscle-legend')).toBeVisible()
  await expect(panel).toContainText('Primary')
  await expect(panel).toContainText('Secondary')
  await expect(panel.locator('.technique-list li').first()).toBeVisible()
  expect(await panel.locator('.technique-list li').count()).toBeGreaterThanOrEqual(3)
  await expect(panel.locator('[data-muscle]')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Exercises' })).toBeVisible()
  await expect(item).toBeVisible()
})

test('a custom exercise shows its muscle map and no technique cues', async ({ page, request }) => {
  const user = await registerViaApi(request, 'mmap-custom')
  const name = `Map Custom ${Date.now()}`
  const created = await request.post(`${API}/api/exercises`, {
    ...auth(user),
    data: { name, primaryMuscleGroup: 'TRICEPS', secondaryMuscleGroups: ['FOREARMS'] },
  })
  expect(created.ok()).toBe(true)
  await openList(page, user)

  await row(page, name).getByRole('button', { name: `Muscles worked: ${name}` }).click()
  const panel = row(page, name).getByRole('tooltip')
  await expect(panel).toBeVisible()
  await expect(panel.locator('[data-muscle="TRICEPS"][data-state="primary"]').first()).toBeVisible()
  await expect(panel.locator('[data-muscle="FOREARMS"][data-state="secondary"]').first()).toBeVisible()
  await expect(panel.locator('.technique-list')).toHaveCount(0)
  await expect(panel).not.toContainText('Proper technique')
})

test('the workout picker trigger shows the map of the selected exercise', async ({ page, request }) => {
  const user = await registerViaApi(request, 'mmap-picker')
  const barbellRow = await exerciseId(request, user, 'Barbell Row')
  await startFreeForm(page, request, user)

  await page.getByLabel('Exercise').selectOption(barbellRow)
  await page.getByRole('button', { name: 'How to do Barbell Row' }).click()
  const panel = page.getByRole('tooltip')
  await expect(panel).toBeVisible()
  await expect(panel.locator('[data-muscle="LATS"][data-state="primary"]').first()).toBeVisible()
  await expect(panel.locator('[data-muscle="BICEPS"][data-state="secondary"]').first()).toBeVisible()
})

test('substitute suggestions show the map for a suggested exercise', async ({ page, request }) => {
  const user = await registerViaApi(request, 'mmap-subs')
  const bench = await exerciseId(request, user, 'Barbell Bench Press')
  await startFreeForm(page, request, user)

  await page.getByLabel('Exercise').selectOption(bench)
  await page.getByRole('button', { name: 'Find substitute' }).click()
  const panel = page.locator('.substitute-panel')
  await expect(panel.locator('.substitute-item').first()).toBeVisible()

  await panel.getByRole('button', { name: /^How to do / }).first().click()
  const tooltip = panel.getByRole('tooltip')
  await expect(tooltip).toBeVisible()
  await expect(tooltip).toContainText('Muscles worked')
  await expect(tooltip.locator('[data-state="primary"]').first()).toBeVisible()
})

test('in Polish the heading and legend are translated', async ({ page, request }) => {
  const user = await registerViaApi(request, 'mmap-pl')
  await openList(page, user, 'pl')

  await page.getByRole('button', { name: /^Jak wykonać: / }).first().click()
  const panel = page.getByRole('tooltip')
  await expect(panel).toBeVisible()
  await expect(panel).toContainText('Pracujące mięśnie')
  await expect(panel).toContainText('Główne')
  await expect(panel).toContainText('Pomocnicze')
  await expect(panel).not.toContainText('Muscles worked')
  await expect(panel).not.toContainText('Secondary')
})
