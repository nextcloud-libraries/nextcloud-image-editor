/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { expect, test } from '@playwright/test'
import { expectColor, save, waitLoaded } from './utils.ts'

test('renders the canvas stage and toolbar', async ({ page }) => {
	await waitLoaded(page)
	await expect(page.getByRole('button', { name: 'Cancel' })).toBeEnabled()
	await expect(page.getByRole('button', { name: 'Draw' })).toBeEnabled()
	await expect(page.getByRole('button', { name: 'Crop' })).toBeEnabled()
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
