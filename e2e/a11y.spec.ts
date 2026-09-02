/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Locator, Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { setInputValue, waitLoaded } from './utils.ts'

/**
 * The pointer target the host asks for. Read from the page rather than
 * hardcoded, because following the host is the point: a server says
 * 34px, and a control sized to anything else looks wrong next to the
 * rest of the interface.
 *
 * @param page the test page
 */
async function clickableArea(page: Page): Promise<number> {
	return page.evaluate(() => Number.parseFloat(getComputedStyle(document.querySelector('.image-editor')!)
		.getPropertyValue('--default-clickable-area')))
}

/**
 * Assert a control is at least as large as the host's pointer target.
 *
 * @param control the control to measure
 * @param name what to call it when the assertion fails
 * @param minimum the pointer target to meet
 */
async function expectClickable(control: Locator, name: string, minimum: number): Promise<void> {
	const box = await control.boundingBox()
	expect(box, `${name} is not rendered`).not.toBeNull()
	expect(box!.width, `${name} is only ${box!.width}px wide`).toBeGreaterThanOrEqual(minimum)
	expect(box!.height, `${name} is only ${box!.height}px tall`).toBeGreaterThanOrEqual(minimum)
}

test('the mode rail meets the minimum pointer target', async ({ page }) => {
	await waitLoaded(page)
	const minimum = await clickableArea(page)
	for (const mode of ['Select', 'Crop', 'Adjust', 'Filter', 'Annotate', 'Sticker', 'Redact']) {
		await expectClickable(page.getByRole('button', { name: mode, exact: true }), `the ${mode} tab`, minimum)
	}
})

test('the annotation tools meet the minimum pointer target', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Annotate' }).click()
	const minimum = await clickableArea(page)
	for (const tool of ['Draw', 'Rectangle', 'Ellipse', 'Arrow', 'Line', 'Text']) {
		await expectClickable(page.getByRole('button', { name: tool, exact: true }), `the ${tool} tool`, minimum)
	}
})

test('the sticker buttons meet the minimum pointer target', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Sticker' }).click()

	const minimum = await clickableArea(page)
	const stickers = page.locator('.sticker-panel button')
	const count = await stickers.count()
	expect(count).toBeGreaterThan(6)
	for (let index = 0; index < count; index++) {
		await expectClickable(stickers.nth(index), `sticker button ${index}`, minimum)
	}
})

test('the crop and history controls meet the minimum pointer target', async ({ page }) => {
	await waitLoaded(page)
	const minimum = await clickableArea(page)
	for (const control of ['Rotate left', 'Rotate right', 'Flip horizontal', 'Flip vertical']) {
		await expectClickable(page.getByRole('button', { name: control, exact: true }), `the ${control} button`, minimum)
	}
	for (const control of ['Undo', 'Redo', 'Zoom in', 'Zoom out']) {
		await expectClickable(page.getByRole('button', { name: control, exact: true }), `the ${control} button`, minimum)
	}
})

test('the rail keeps its pointer target on a phone-sized container', async ({ page }) => {
	await waitLoaded(page)
	// Under the container query breakpoint the rail gets narrower, but
	// never narrower than the pointer target
	await page.setViewportSize({ width: 420, height: 720 })
	const minimum = await clickableArea(page)
	for (const mode of ['Select', 'Crop', 'Annotate', 'Redact']) {
		await expectClickable(page.getByRole('button', { name: mode, exact: true }), `the ${mode} tab`, minimum)
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

test('the controls follow the host pointer target rather than their own', async ({ page }) => {
	await waitLoaded(page)

	// A Nextcloud server says 34px, and declaring our own value here is
	// what once made every control 10px larger than the interface
	// around it
	expect(await clickableArea(page)).toBe(34)

	// A button whose height the variable actually decides. The rail tabs
	// are taller than the pointer target by design, since they stack a
	// label under an icon.
	const box = (await page.locator('[data-test="aspect-free"]').boundingBox())!
	expect(box.height).toBe(34)
})
