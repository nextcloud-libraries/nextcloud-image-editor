/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Locator, Page } from '@playwright/test'

import { expect } from '@playwright/test'

export interface SavedProbe {
	size: number
	width: number
	height: number
	mimeType: string
	topLeft: number[]
	topRight: number[]
	bottomLeft: number[]
	center: number[]
}

/**
 * Wait for the editor to finish loading the fixture image.
 *
 * @param page the test page
 */
export async function waitLoaded(page: Page): Promise<void> {
	// The deterministic 200x100 fixture; the default page shows a real
	// photo for humans
	await page.goto('/?src=test')
	await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled()
}

/**
 * Click save and return the decoded export payload with pixel probes.
 *
 * @param page the test page
 */
export async function save(page: Page): Promise<SavedProbe> {
	const saved = page.locator('[data-test="saved"]')
	const before = await saved.innerText()
	await page.getByRole('button', { name: 'Save' }).click()
	await expect(saved).not.toHaveText(before)
	return JSON.parse(await saved.innerText())
}

/**
 * Read the editor state mirrored by the playground.
 *
 * @param page the test page
 */
export async function readState(page: Page) {
	const text = await page.locator('[data-test="state"]').innerText()
	return JSON.parse(text)
}

/**
 * Screen position of the fixture image's top-left corner. The 200x100
 * fixture is displayed unscaled and centered in the canvas area.
 *
 * @param page the test page
 * @param width current visible image width, defaults to the fixture's
 * @param height current visible image height, defaults to the fixture's
 */
export async function imageTopLeft(page: Page, width = 200, height = 100) {
	const box = await page.locator('.image-editor__canvas').boundingBox()
	if (box === null) {
		throw new Error('Canvas area not found')
	}
	return {
		x: box.x + (box.width - width) / 2,
		y: box.y + (box.height - height) / 2,
	}
}

/**
 * Drag the mouse between two points with intermediate moves, emitting
 * the pointer events the editor tools listen to.
 *
 * @param page the test page
 * @param from drag start in page coordinates
 * @param from.x horizontal start
 * @param from.y vertical start
 * @param to drag end in page coordinates
 * @param to.x horizontal end
 * @param to.y vertical end
 */
export async function drag(page: Page, from: { x: number, y: number }, to: { x: number, y: number }) {
	await page.mouse.move(from.x, from.y)
	await page.mouse.down()
	await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 5 })
	await page.mouse.move(to.x, to.y, { steps: 5 })
	await page.mouse.up()
}

/**
 * Like drag(), but paced with short pauses so window-level drag handlers
 * (e.g. Konva transformer anchors) track every step across browsers.
 *
 * @param page the test page
 * @param from drag start in page coordinates
 * @param from.x horizontal start
 * @param from.y vertical start
 * @param to drag end in page coordinates
 * @param to.x horizontal end
 * @param to.y vertical end
 */
export async function slowDrag(page: Page, from: { x: number, y: number }, to: { x: number, y: number }) {
	await page.mouse.move(from.x, from.y)
	await page.mouse.down()
	for (const fraction of [0.2, 0.4, 0.6, 0.8, 1]) {
		await page.mouse.move(
			from.x + (to.x - from.x) * fraction,
			from.y + (to.y - from.y) * fraction,
		)
		await page.waitForTimeout(50)
	}
	await page.mouse.up()
}

/**
 * Set a range or color input value, firing the input and change events
 * that fill() does not support on these input types.
 *
 * @param locator the input element
 * @param value the value to set
 */
export async function setInputValue(locator: Locator, value: string) {
	await locator.evaluate((element, newValue) => {
		const input = element as HTMLInputElement
		input.value = newValue
		input.dispatchEvent(new Event('input', { bubbles: true }))
		input.dispatchEvent(new Event('change', { bubbles: true }))
	}, value)
}

/**
 * Assert a probed pixel is close to the expected color.
 *
 * @param pixel the probed [r, g, b, a] values
 * @param expected the expected [r, g, b] values
 * @param tolerance allowed per-channel deviation
 */
export function expectColor(pixel: number[], expected: [number, number, number], tolerance = 10) {
	expect(Math.abs(pixel[0] - expected[0])).toBeLessThanOrEqual(tolerance)
	expect(Math.abs(pixel[1] - expected[1])).toBeLessThanOrEqual(tolerance)
	expect(Math.abs(pixel[2] - expected[2])).toBeLessThanOrEqual(tolerance)
}
