import { expect, test } from '@playwright/test'
import { PASSWORD, registerViaApi } from './helpers.js'

// Test plan risk R12: on a phone every page must stay reachable (the old top bar overflowed).
test.use({ viewport: { width: 375, height: 667 } })

test('on a phone the navigation lives in a left-side menu that opens, navigates and closes', async ({ page, request }) => {
  const user = await registerViaApi(request, 'mobile')

  await page.addInitScript(() => localStorage.setItem('gymtrack.lang', 'en'))
  await page.goto('/login')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  const menu = page.locator('#topbar-panel')

  // Closed: only the hamburger is shown, the links are not reachable.
  const toggle = page.getByRole('button', { name: 'Menu', exact: true })
  await expect(toggle).toBeVisible()
  await expect(menu.getByRole('link', { name: 'Plans', exact: true })).toBeHidden()

  // Open: every link plus language switch and logout are inside the screen.
  await toggle.click()
  for (const name of ['Dashboard', 'Workout', 'History', 'Plans', 'Exercises']) {
    await expect(menu.getByRole('link', { name, exact: true })).toBeVisible()
  }
  await expect(menu.getByRole('button', { name: 'Log out' })).toBeVisible()
  const panel = await menu.boundingBox()
  expect(panel).not.toBeNull()
  expect(panel!.x).toBeGreaterThanOrEqual(0)
  expect(panel!.x + panel!.width).toBeLessThanOrEqual(375)

  // Choosing a link navigates and closes the menu.
  await menu.getByRole('link', { name: 'Plans', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Plans' })).toBeVisible()
  // The otherwise empty bar names the current page.
  await expect(page.locator('.topbar-title')).toHaveText('Plans')
  await expect(menu.getByRole('link', { name: 'Plans', exact: true })).toBeHidden()

  // Escape closes it too.
  await toggle.click()
  await expect(menu.getByRole('link', { name: 'History', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(menu.getByRole('link', { name: 'History', exact: true })).toBeHidden()
})
