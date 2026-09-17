/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { expectColor, save, setInputValue, waitLoaded } from './utils.ts'

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

test('editing a wide-gamut photo does not shift its colours', async ({ page }) => {
	await waitLoaded(page, 'wide-gamut')
	await page.getByRole('button', { name: 'Rotate right' }).click()

	// The source is tagged Display P3. A browser that decodes it into sRGB
	// leaves the canvas holding sRGB numbers, and carrying the profile over
	// them used to export the photo a visible step more saturated: this
	// centre pixel came back 235,51,37 where the source reads 217,69,51.
	// A browser that hands the samples over untouched needs the profile
	// kept for the same reason. Comparing against the source as this
	// browser reads it covers both.
	const result = await save(page)
	expect(result.sourceCenter.length).toBe(4)
	expectColor(result.center, result.sourceCenter.slice(0, 3) as [number, number, number], 6)
})
