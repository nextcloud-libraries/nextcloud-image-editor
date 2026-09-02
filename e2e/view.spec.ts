/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { imageTopLeft, imageView, readState, waitLoaded } from './utils.ts'

/**
 * The zoom percentage shown in the top bar.
 *
 * @param page the test page
 */
async function zoom(page: Page): Promise<number> {
	const text = await page.locator('[data-test="zoom-reset"]').innerText()
	return Number.parseInt(text, 10)
}

/**
 * Put the pointer over the middle of the canvas.
 *
 * @param page the test page
 */
async function centerPointer(page: Page) {
	const box = await page.locator('.image-editor__canvas').boundingBox()
	if (box === null) {
		throw new Error('Canvas area not found')
	}
	const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
	await page.mouse.move(center.x, center.y)
	return center
}

test('the wheel zooms instead of scrolling the image away', async ({ page }) => {
	await waitLoaded(page)
	await centerPointer(page)

	await page.mouse.wheel(0, -120)
	await expect.poll(() => zoom(page)).toBeGreaterThan(100)

	const zoomedIn = await zoom(page)
	await page.mouse.wheel(0, 120)
	await expect.poll(() => zoom(page)).toBeLessThan(zoomedIn)
})

test('the wheel holds the fitted view at its floor', async ({ page }) => {
	await waitLoaded(page)
	await centerPointer(page)

	await page.mouse.wheel(0, 240)
	expect(await zoom(page)).toBe(100)
	// The fitted view is centered, so nothing may have shifted either
	expect((await imageView(page)).x).toBeCloseTo((await imageView(page)).x, 5)
})

test('zooming at the cursor keeps that corner of the image in view', async ({ page }) => {
	await waitLoaded(page)
	const corner = await imageTopLeft(page)
	await page.mouse.move(corner.x + 10, corner.y + 10)

	const before = await imageView(page)
	await page.mouse.wheel(0, -240)
	await expect.poll(() => zoom(page)).toBeGreaterThan(100)

	// Anchoring on the top left drags the view origin left and up rather
	// than magnifying around the container center
	const after = await imageView(page)
	expect(after.scale).toBeGreaterThan(before.scale)
	expect(after.x).toBeLessThan(before.x)
})

test('space and drag pans in a mode where the tool owns the drag', async ({ page }) => {
	await waitLoaded(page, 'large')
	// Crop mode: a plain drag belongs to the crop rectangle. Zooming with
	// the wheel also keeps the focus off the top bar buttons, which would
	// otherwise claim the space bar
	const center = await centerPointer(page)
	// Enough zoom that the content overflows the container horizontally,
	// otherwise there is legitimately nothing to pan
	await page.mouse.wheel(0, -300)
	await page.mouse.wheel(0, -300)
	await expect.poll(() => zoom(page)).toBeGreaterThan(200)

	const before = await imageView(page)
	await page.keyboard.down('Space')
	await page.mouse.down()
	await page.mouse.move(center.x - 120, center.y - 60, { steps: 5 })
	await page.mouse.up()
	await page.keyboard.up('Space')

	const after = await imageView(page)
	expect(after.x).toBeLessThan(before.x)
})

test('the middle button pans without drawing', async ({ page }) => {
	await waitLoaded(page, 'large')
	await page.getByRole('button', { name: 'Annotate' }).click()
	await page.getByRole('button', { name: 'Draw' }).click()
	await page.locator('[data-test="zoom-in"]').click()
	await page.locator('[data-test="zoom-in"]').click()

	const center = await centerPointer(page)
	const before = await imageView(page)

	await page.mouse.down({ button: 'middle' })
	await page.mouse.move(center.x - 50, center.y - 30, { steps: 5 })
	await page.mouse.up({ button: 'middle' })

	const after = await imageView(page)
	expect(after.x).toBeLessThan(before.x)
	expect((await readState(page)).annotations).toHaveLength(0)
})

test('panning past the edge does not leave the view stuck', async ({ page }) => {
	await waitLoaded(page, 'large')
	await page.getByRole('button', { name: 'Adjust', exact: true }).click()
	await page.locator('[data-test="zoom-in"]').click()
	await page.locator('[data-test="zoom-in"]').click()

	const center = await centerPointer(page)

	// Shove the view far past its left bound several times over
	for (let attempt = 0; attempt < 3; attempt++) {
		await page.mouse.move(center.x, center.y)
		await page.mouse.down()
		await page.mouse.move(center.x - 2000, center.y, { steps: 3 })
		await page.mouse.up()
	}
	const clamped = await imageView(page)

	// One short drag back has to move the view immediately, instead of
	// spending itself undoing an accumulated overshoot
	await page.mouse.move(center.x, center.y)
	await page.mouse.down()
	await page.mouse.move(center.x + 40, center.y, { steps: 3 })
	await page.mouse.up()

	expect((await imageView(page)).x).toBeGreaterThan(clamped.x)
})
