/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { expect, test } from '@playwright/test'
import { cropAnchor, expectColor, imageView, readState, save, setInputValue, slowDrag, waitLoaded } from './utils.ts'

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
	await page.getByRole('button', { name: 'Crop', exact: true }).click()
	await expect(page.locator('[data-test="apply-crop"]')).toBeVisible()
	// Give the canvas overlay a moment to attach its pointer handlers
	await page.waitForTimeout(100)

	// Drag the top-left transformer anchor towards the image center,
	// grabbing it exactly where Konva reports it. Synthetic fast drags
	// lose a few initial pixels, so assertions accept a range.
	const view = await imageView(page)
	const anchor = await cropAnchor(page, 'top-left')
	await slowDrag(page, anchor, { x: anchor.x + 50 * view.scale, y: anchor.y + 25 * view.scale })
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

test('fine rotation and zoom scrub without changing export size', async ({ page }) => {
	await waitLoaded(page)

	await setInputValue(page.locator('[data-test="fine-rotation"]'), '30')
	expect((await readState(page)).fineRotation).toBe(30)

	await page.locator('[data-test="tab-scale"]').click()
	await setInputValue(page.locator('[data-test="zoom"]'), '2')
	expect((await readState(page)).zoom).toBe(2)

	// Cover scaling keeps the frame identical whatever the angle or zoom
	const result = await save(page)
	expect(result.width).toBe(200)
	expect(result.height).toBe(100)

	// Each slider release is one undo step
	await page.getByRole('button', { name: 'Undo' }).click()
	expect((await readState(page)).zoom).toBe(1)
	await page.getByRole('button', { name: 'Undo' }).click()
	expect((await readState(page)).fineRotation).toBe(0)
})

test('dismissing the revert confirmation keeps every edit', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Rotate right' }).click()
	await expect.poll(async () => (await readState(page)).rotation).toBe(90)

	await page.locator('[data-test="revert"]').click()
	const dialog = page.getByRole('dialog')
	await dialog.getByRole('button', { name: 'Cancel' }).click()
	await expect(dialog).toBeHidden()

	expect((await readState(page)).rotation).toBe(90)
})

test('revert clears every edit as one undoable step', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Rotate right' }).click()
	await page.getByRole('button', { name: 'Flip horizontal' }).click()

	await page.locator('[data-test="revert"]').click()
	// The shared confirmation dialog is spawned outside the editor
	await page.getByRole('dialog').getByRole('button', { name: 'Revert all changes' }).click()
	const state = await readState(page)
	expect(state.rotation).toBe(0)
	expect(state.flipX).toBe(false)

	// Undoing the revert restores the rotated and flipped state; the
	// visual horizontal flip landed on flipY while the image was sideways
	await page.getByRole('button', { name: 'Undo' }).click()
	const restored = await readState(page)
	expect(restored.rotation).toBe(90)
	expect(restored.flipY).toBe(true)
})

test('aspect presets lock the crop ratio', async ({ page }) => {
	await waitLoaded(page)
	await expect(page.locator('[data-test="apply-crop"]')).toBeVisible()

	await page.locator('[data-test="aspect-1:1"]').click()
	await page.locator('[data-test="apply-crop"]').click()

	const crop = (await readState(page)).crop
	expect(crop.width).toBe(crop.height)

	const result = await save(page)
	expect(result.width).toBe(result.height)
})

test('the history lists every step and jumps to one', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Rotate right' }).click()
	await page.getByRole('button', { name: 'Flip horizontal' }).click()
	await expect.poll(async () => (await readState(page)).flipY).toBe(true)

	await page.locator('[data-test="history"] button').click()
	const steps = page.locator('[data-test^="history-step-"]')

	// Newest first, with the state on screen at the top
	await expect(steps).toHaveCount(3)
	await expect(steps.nth(0)).toContainText('Flip horizontal')
	await expect(steps.nth(1)).toContainText('Rotate right')
	await expect(steps.nth(2)).toContainText('Original')

	// Two steps back in one go, rather than two undos
	await page.locator('[data-test="history-step-0"]').click()
	const state = await readState(page)
	expect(state.rotation).toBe(0)
	expect(state.flipX).toBe(false)
	expect(state.flipY).toBe(false)
})

test('a step taken after a jump replaces the abandoned ones', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Rotate right' }).click()
	await page.getByRole('button', { name: 'Rotate right' }).click()
	await expect.poll(async () => (await readState(page)).rotation).toBe(180)

	await page.locator('[data-test="history"] button').click()
	await page.locator('[data-test="history-step-1"]').click()
	await expect.poll(async () => (await readState(page)).rotation).toBe(90)

	await page.getByRole('button', { name: 'Flip vertical' }).click()
	await page.locator('[data-test="history"] button').click()

	// The second rotation is gone: the flip took its place
	const steps = page.locator('[data-test^="history-step-"]')
	await expect(steps).toHaveCount(3)
	await expect(steps.nth(0)).toContainText('Flip vertical')
	await expect(steps.nth(1)).toContainText('Rotate right')
})
