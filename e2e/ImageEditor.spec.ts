/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { expect, test } from '@playwright/test'
import { expectColor, save, waitLoaded } from './utils.ts'

test('renders the canvas stage and chrome', async ({ page }) => {
	await waitLoaded(page)
	await expect(page.getByRole('button', { name: 'Cancel' })).toBeEnabled()
	for (const mode of ['Crop', 'Adjust', 'Filter', 'Annotate', 'Sticker']) {
		await expect(page.getByRole('button', { name: mode, exact: true })).toBeEnabled()
	}
	await expect(page.locator('[role="img"] canvas').first()).toBeVisible()
})

test('emits cancel', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Cancel' }).click()
	await expect(page.locator('[data-test="cancelled"]')).toHaveText('1')
})

test('exports the unedited image faithfully', async ({ page }) => {
	await waitLoaded(page)
	const result = await save(page)

	expect(result.mimeType).toBe('image/png')
	expect(result.width).toBe(200)
	expect(result.height).toBe(100)
	expectColor(result.topLeft, [200, 0, 0])
	expectColor(result.topRight, [0, 0, 200])
})

test('emits error for an undecodable source', async ({ page }) => {
	await page.goto('/?src=broken')
	await expect(page.locator('[data-test="errors"]')).toHaveText('Image could not be decoded')
	await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled()
})

test('view zoom magnifies without touching the edit state', async ({ page }) => {
	await waitLoaded(page)
	await expect(page.locator('[data-test="zoom-out"]')).toBeDisabled()

	await page.locator('[data-test="zoom-in"]').click()
	await expect(page.locator('[data-test="zoom-out"]')).toBeEnabled()

	// Purely a view concern: the state and the export stay untouched
	const result = await save(page)
	expect(result.width).toBe(200)
	expect(result.height).toBe(100)
})
