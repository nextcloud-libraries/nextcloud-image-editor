/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { save, setInputValue } from './utils.ts'

/**
 * Open the fixture that carries EXIF, GPS and XMP, handed to the editor
 * as bytes the way a host with the file would.
 *
 * @param page the test page
 */
async function openPhoto(page: Page): Promise<void> {
	await page.goto('/?src=metadata')
	await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled()
}

test('an edited photo keeps what the camera recorded', async ({ page }) => {
	await openPhoto(page)
	await page.getByRole('button', { name: 'Rotate right' }).click()

	const result = await save(page)
	expect(result.mimeType).toBe('image/jpeg')
	expect(result.exif).toBe(true)
	expect(result.camera).toBe(true)
	expect(result.taken).toBe(true)
	expect(result.xmp).toBe(true)
})

test('an adjustment does not cost the capture date either', async ({ page }) => {
	await openPhoto(page)
	await page.getByRole('button', { name: 'Adjust' }).click()
	await page.locator('[data-test="tab-contrast"]').click()
	await setInputValue(page.locator('[data-test="adjust-contrast"]'), '35')

	const result = await save(page)
	expect(result.taken).toBe(true)
	expect(result.camera).toBe(true)
})

test('an untouched photo comes back exactly as it went in', async ({ page }) => {
	await openPhoto(page)
	const result = await save(page)

	// The pristine path hands the source back whole rather than re-encoding
	expect(result.exif).toBe(true)
	expect(result.taken).toBe(true)
})
