/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Locator } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { setInputValue, waitLoaded } from './utils.ts'

/** The pointer target size Nextcloud sizes its controls to */
const CLICKABLE_AREA = 44

/**
 * Assert a control is at least as large as the minimum pointer target.
 *
 * @param control the control to measure
 * @param name what to call it when the assertion fails
 */
async function expectClickable(control: Locator, name: string): Promise<void> {
	const box = await control.boundingBox()
	expect(box, `${name} is not rendered`).not.toBeNull()
	expect(box!.width, `${name} is only ${box!.width}px wide`).toBeGreaterThanOrEqual(CLICKABLE_AREA)
	expect(box!.height, `${name} is only ${box!.height}px tall`).toBeGreaterThanOrEqual(CLICKABLE_AREA)
}

test('the mode rail meets the minimum pointer target', async ({ page }) => {
	await waitLoaded(page)
	for (const mode of ['Select', 'Crop', 'Adjust', 'Filter', 'Annotate', 'Sticker', 'Redact']) {
		await expectClickable(page.getByRole('button', { name: mode, exact: true }), `the ${mode} tab`)
	}
})

test('the annotation tools meet the minimum pointer target', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Annotate' }).click()
	for (const tool of ['Draw', 'Rectangle', 'Ellipse', 'Arrow', 'Text']) {
		await expectClickable(page.getByRole('button', { name: tool, exact: true }), `the ${tool} tool`)
	}
})

test('the sticker buttons meet the minimum pointer target', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Sticker' }).click()

	const stickers = page.locator('.sticker-panel button')
	const count = await stickers.count()
	expect(count).toBeGreaterThan(6)
	for (let index = 0; index < count; index++) {
		await expectClickable(stickers.nth(index), `sticker button ${index}`)
	}
})

test('the crop and history controls meet the minimum pointer target', async ({ page }) => {
	await waitLoaded(page)
	for (const control of ['Rotate left', 'Rotate right', 'Flip horizontal', 'Flip vertical']) {
		await expectClickable(page.getByRole('button', { name: control, exact: true }), `the ${control} button`)
	}
	for (const control of ['Undo', 'Redo', 'Zoom in', 'Zoom out']) {
		await expectClickable(page.getByRole('button', { name: control, exact: true }), `the ${control} button`)
	}
})

test('the rail keeps its pointer target on a phone-sized container', async ({ page }) => {
	await waitLoaded(page)
	// Under the container query breakpoint the rail gets narrower, but
	// never narrower than the pointer target
	await page.setViewportSize({ width: 420, height: 720 })
	for (const mode of ['Select', 'Crop', 'Annotate', 'Redact']) {
		await expectClickable(page.getByRole('button', { name: mode, exact: true }), `the ${mode} tab`)
	}
})

test('the size sliders preview the mark at its drawn size', async ({ page }) => {
	await waitLoaded(page, 'large')
	await page.getByRole('button', { name: 'Annotate' }).click()
	await page.getByRole('button', { name: 'Draw', exact: true }).click()

	const dot = page.locator('[data-test="stroke-preview"]')
	await expect(dot).toBeVisible()

	await setInputValue(page.locator('[aria-label="Stroke width"]'), '4')
	const thin = (await dot.boundingBox())!.width
	await setInputValue(page.locator('[aria-label="Stroke width"]'), '32')
	const thick = (await dot.boundingBox())!.width

	// The preview follows the value rather than being a fixed swatch
	expect(thick).toBeGreaterThan(thin)

	// The text tool previews a glyph at the font size instead
	await page.getByRole('button', { name: 'Text', exact: true }).click()
	await expect(page.locator('[data-test="font-preview"]')).toBeVisible()
	await expect(dot).toBeHidden()
})
