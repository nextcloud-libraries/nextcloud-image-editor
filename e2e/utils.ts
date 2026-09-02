/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Locator, Page } from '@playwright/test'
import type Konva from 'konva'

import { expect } from '@playwright/test'

declare global {
	interface Window {
		/** Konva registers itself globally in the browser build */
		Konva: { stages: Konva.Stage[] }
	}
}

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
 * @param src which playground fixture to load: the deterministic
 * 200x100 image by default, or 'large' for the 2000x1500 one whose
 * fitted view is downscaled. The default page shows a real photo for
 * humans instead.
 */
export async function waitLoaded(page: Page, src: 'test' | 'large' = 'test'): Promise<void> {
	await page.goto(`/?src=${src}`)
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
 * The crop rectangle's box in stage pixels, read from Konva.
 *
 * @param page the test page
 */
export async function cropStageRect(page: Page) {
	return page.evaluate(() => {
		const node = window.Konva.stages[0]?.findOne('.crop-rect')
		if (node === undefined) {
			return null
		}
		return {
			x: node.x(),
			y: node.y(),
			width: node.width() * node.scaleX(),
			height: node.height() * node.scaleY(),
		}
	})
}

/**
 * On-screen position of a crop transformer anchor, read from Konva.
 *
 * The overlay is only attached once the container has been measured,
 * and a late resize observation moves it, so the position is only
 * trustworthy after it stops changing. Reading it too early makes a
 * drag miss the 14px anchor and grab the rectangle instead, which
 * silently moves the crop rather than resizing it.
 *
 * @param page the test page
 * @param name anchor name, e.g. 'top-left'
 */
export async function cropAnchor(page: Page, name: string) {
	const read = () => page.evaluate((anchorName) => {
		const stage = window.Konva.stages[0]
		const anchor = stage?.findOne(`.${anchorName}`)
		if (stage === undefined || anchor === undefined) {
			return null
		}
		const rect = stage.container().getBoundingClientRect()
		const position = anchor.getAbsolutePosition()
		return { x: rect.x + position.x, y: rect.y + position.y }
	}, name)

	let previous: { x: number, y: number } | null = null
	await expect.poll(async () => {
		const current = await read()
		const stable = current !== null && previous !== null
			&& current.x === previous.x && current.y === previous.y
		previous = current
		return stable
	}, { message: `The ${name} crop anchor never settled` }).toBe(true)

	return previous!
}

/**
 * Exact on-screen position and scale of the image, read from the Konva
 * scene itself; needed where a mode rests at a fit other than 1:1.
 *
 * @param page the test page
 */
export async function imageView(page: Page) {
	return page.evaluate(() => {
		const stage = window.Konva.stages[0]!
		const rect = stage.container().getBoundingClientRect()
		// The named view group carries the view transform; the content
		// group inside it is only transformed while a transition plays
		const group = stage.findOne('.view')!
		return {
			x: rect.x + group.x(),
			y: rect.y + group.y(),
			scale: group.scaleX(),
		}
	})
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
