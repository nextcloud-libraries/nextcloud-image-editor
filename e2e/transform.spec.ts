/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { expect, test } from '@playwright/test'
import { expectColor, imageTopLeft, readState, save, slowDrag, waitLoaded } from './utils.ts'

test('rotate right turns the image clockwise', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Rotate right' }).click()

	expect((await readState(page)).rotation).toBe(90)

	const result = await save(page)
	expect(result.width).toBe(100)
	expect(result.height).toBe(200)
	// The red left half becomes the top half, blue ends bottom-left
	expectColor(result.topLeft, [200, 0, 0])
	expectColor(result.topRight, [200, 0, 0])
	expectColor(result.bottomLeft, [0, 0, 200])
})

test('four right rotations return to the original', async ({ page }) => {
	await waitLoaded(page)
	for (let i = 0; i < 4; i++) {
		await page.getByRole('button', { name: 'Rotate right' }).click()
	}

	expect((await readState(page)).rotation).toBe(0)
	const result = await save(page)
	expect(result.width).toBe(200)
	expectColor(result.topLeft, [200, 0, 0])
	expectColor(result.topRight, [0, 0, 200])
})

test('rotate left is the inverse of rotate right', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Rotate left' }).click()
	expect((await readState(page)).rotation).toBe(270)
	await page.getByRole('button', { name: 'Rotate right' }).click()
	expect((await readState(page)).rotation).toBe(0)
})

test('flip horizontal mirrors the image', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Flip horizontal' }).click()

	const result = await save(page)
	expectColor(result.topLeft, [0, 0, 200])
	expectColor(result.topRight, [200, 0, 0])
})

test('cropping reduces the export to the selected area', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Crop' }).click()
	await expect(page.locator('[data-test="apply-crop"]')).toBeVisible()
	// Give the canvas overlay a moment to attach its pointer handlers
	await page.waitForTimeout(100)

	// Drag the top-left transformer anchor towards the image center.
	// Synthetic fast drags lose a few initial pixels in the transformer,
	// so the assertions accept a range instead of exact coordinates.
	const corner = await imageTopLeft(page)
	await slowDrag(page, corner, { x: corner.x + 50, y: corner.y + 25 })
	await page.locator('[data-test="apply-crop"]').click()

	// Only the top-left anchor moved, so the crop must keep the image's
	// right and bottom edges regardless of how far the drag registered
	const crop = (await readState(page)).crop
	expect(crop.x).toBeGreaterThan(5)
	expect(crop.x).toBeLessThanOrEqual(55)
	expect(crop.y).toBeGreaterThan(2)
	expect(crop.y).toBeLessThanOrEqual(30)
	expect(crop.width).toBe(200 - crop.x)
	expect(crop.height).toBe(100 - crop.y)

	// The export must match the applied crop exactly
	const result = await save(page)
	expect(result.width).toBe(crop.width)
	expect(result.height).toBe(crop.height)
})

test('undo and redo walk the edit history', async ({ page }) => {
	await waitLoaded(page)
	await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled()

	await page.getByRole('button', { name: 'Rotate right' }).click()
	expect((await readState(page)).rotation).toBe(90)

	await page.getByRole('button', { name: 'Undo' }).click()
	expect((await readState(page)).rotation).toBe(0)

	await page.getByRole('button', { name: 'Redo' }).click()
	expect((await readState(page)).rotation).toBe(90)
})
