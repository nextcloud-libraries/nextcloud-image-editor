/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { expect, test } from '@playwright/test'

test('renders the canvas stage and toolbar', async ({ page }) => {
	await page.goto('/')
	await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled()
	await expect(page.getByRole('button', { name: 'Cancel' })).toBeEnabled()
	await expect(page.locator('[role="img"] canvas')).toHaveCount(1)
})

test('emits cancel', async ({ page }) => {
	await page.goto('/')
	await page.getByRole('button', { name: 'Cancel' }).click()
	await expect(page.locator('[data-test="cancelled"]')).toHaveText('1')
})

test('emits save with the image exported at natural size', async ({ page }) => {
	await page.goto('/')
	await page.getByRole('button', { name: 'Save' }).click()

	const saved = page.locator('[data-test="saved"]')
	await expect(saved).not.toBeEmpty()
	const result = JSON.parse(await saved.innerText())
	expect(result.mimeType).toBe('image/png')
	expect(result.width).toBe(1)
	expect(result.height).toBe(1)
	expect(result.size).toBeGreaterThan(0)
})

test('emits error for an undecodable source', async ({ page }) => {
	await page.goto('/?src=broken')
	await expect(page.locator('[data-test="errors"]')).toHaveText('Image could not be decoded')
	await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled()
})
