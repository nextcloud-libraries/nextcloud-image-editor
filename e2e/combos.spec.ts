/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { expect, test } from '@playwright/test'
import { drag, expectColor, imageTopLeft, readState, save, setInputValue, waitLoaded } from './utils.ts'

test('every filter preset changes the exported pixels', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Filter', exact: true }).click()

	const baseline = await save(page)
	// Solarize is covered separately: it only inverts luma above 128 and
	// this fixture sits entirely below the threshold
	for (const preset of ['pop', 'warm', 'cool', 'fade', 'grayscale', 'noir', 'sepia', 'invert', 'posterize']) {
		await page.locator(`[data-test="preset-${preset}"]`).click()
		expect((await readState(page)).preset).toBe(preset)

		const result = await save(page)
		const moved = ['topLeft', 'topRight', 'center'].some((probe) => (result as never as Record<string, number[]>)[probe]!.some((channel, i) => Math.abs(channel - (baseline as never as Record<string, number[]>)[probe]![i]!) > 4))
		expect(moved, `${preset} left the pixels untouched`).toBe(true)
	}

	await page.locator('[data-test="preset-none"]').click()
	const back = await save(page)
	expectColor(back.topLeft, [200, 0, 0])
})

test('solarize inverts only bright regions', async ({ page }) => {
	await waitLoaded(page)

	// Untouched below the luma threshold
	await page.getByRole('button', { name: 'Filter', exact: true }).click()
	await page.locator('[data-test="preset-solarize"]').click()
	const dark = await save(page)
	expectColor(dark.topLeft, [200, 0, 0])

	// Brightened above the threshold it inverts
	await page.getByRole('button', { name: 'Adjust' }).click()
	await setInputValue(page.locator('[data-test="adjust-brightness"]'), '70')
	const bright = await save(page)
	expect(bright.topLeft[1]!).toBeLessThan(120)
})

test('tint presets shift channels in opposite directions', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Filter', exact: true }).click()

	await page.locator('[data-test="preset-warm"]').click()
	const warm = await save(page)
	await page.locator('[data-test="preset-cool"]').click()
	const cool = await save(page)

	// The blue half gains red warmth and loses it again under cool
	expect(warm.topRight[2]!).toBeLessThan(cool.topRight[2]!)
})

test('adjustment and preset combine in the export', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Adjust' }).click()
	await setInputValue(page.locator('[data-test="adjust-brightness"]'), '-40')
	await page.getByRole('button', { name: 'Filter', exact: true }).click()
	await page.locator('[data-test="preset-grayscale"]').click()

	const result = await save(page)
	const [r, g, b] = result.topLeft
	expect(Math.abs(r! - g!)).toBeLessThanOrEqual(2)
	expect(Math.abs(g! - b!)).toBeLessThanOrEqual(2)
	// Darkened well below the plain grayscale value of rgb(200,0,0)
	expect(r!).toBeLessThan(50)
})

test('rotate, crop, filter, draw and export work as one pipeline', async ({ page }) => {
	await waitLoaded(page)

	await page.getByRole('button', { name: 'Rotate right' }).click()
	await page.locator('[data-test="aspect-1:1"]').click()
	await page.locator('[data-test="apply-crop"]').click()

	await page.getByRole('button', { name: 'Filter', exact: true }).click()
	await page.locator('[data-test="preset-sepia"]').click()

	await page.getByRole('button', { name: 'Annotate' }).click()
	await page.getByRole('button', { name: 'Draw' }).click()
	const corner = await imageTopLeft(page, 100, 100)
	await drag(page, { x: corner.x + 20, y: corner.y + 50 }, { x: corner.x + 80, y: corner.y + 50 })

	const state = await readState(page)
	expect(state.rotation).toBe(90)
	expect(state.crop.width).toBe(state.crop.height)
	expect(state.preset).toBe('sepia')
	expect(state.annotations).toHaveLength(1)

	const result = await save(page)
	expect(result.width).toBe(state.crop.width)
	expect(result.height).toBe(state.crop.height)
})

test('flips remap redactions with the image', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Redact', exact: true }).click()

	const corner = await imageTopLeft(page)
	await drag(page, { x: corner.x + 10, y: corner.y + 20 }, { x: corner.x + 50, y: corner.y + 60 })
	const before = (await readState(page)).annotations[0].rect

	await page.getByRole('button', { name: 'Crop', exact: true }).click()
	await page.getByRole('button', { name: 'Flip horizontal' }).click()
	const after = (await readState(page)).annotations[0].rect

	expect(after.x).toBeCloseTo(200 - before.x - before.width, 5)
	expect(after.y).toBeCloseTo(before.y, 5)
})

test('a mixed edit stack unwinds fully through undo', async ({ page }) => {
	await waitLoaded(page)

	await page.getByRole('button', { name: 'Rotate right' }).click()
	await page.getByRole('button', { name: 'Flip vertical' }).click()
	await page.getByRole('button', { name: 'Adjust' }).click()
	await page.locator('[data-test="tab-contrast"]').click()
	await setInputValue(page.locator('[data-test="adjust-contrast"]'), '25')
	await page.getByRole('button', { name: 'Sticker', exact: true }).click()
	const corner = await imageTopLeft(page, 100, 200)
	await page.mouse.click(corner.x + 50, corner.y + 100)

	for (let i = 0; i < 4; i++) {
		await page.getByRole('button', { name: 'Undo' }).click()
	}

	const state = await readState(page)
	expect(state.rotation).toBe(0)
	expect(state.flipY).toBe(false)
	expect(state.adjustments.contrast).toBe(0)
	expect(state.annotations).toHaveLength(0)

	const result = await save(page)
	expectColor(result.topLeft, [200, 0, 0])
	expectColor(result.topRight, [0, 0, 200])
})

test('fine rotation combines with crop and annotations', async ({ page }) => {
	await waitLoaded(page)
	await setInputValue(page.locator('[data-test="fine-rotation"]'), '20')
	await page.locator('[data-test="aspect-original"]').click()
	await page.locator('[data-test="apply-crop"]').click()

	await page.getByRole('button', { name: 'Annotate' }).click()
	await page.getByRole('button', { name: 'Rectangle' }).click()
	const crop = (await readState(page)).crop
	const corner = await imageTopLeft(page, crop.width, crop.height)
	await drag(page, { x: corner.x + 10, y: corner.y + 10 }, { x: corner.x + 40, y: corner.y + 30 })

	const state = await readState(page)
	expect(state.fineRotation).toBe(20)
	expect(state.annotations).toHaveLength(1)

	const result = await save(page)
	expect(result.width).toBe(crop.width)
	expect(result.height).toBe(crop.height)
})

test('redaction survives a rotation in the export', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Redact', exact: true }).click()

	const corner = await imageTopLeft(page)
	await drag(page, { x: corner.x + 58, y: corner.y + 20 }, { x: corner.x + 138, y: corner.y + 80 })

	await page.getByRole('button', { name: 'Crop', exact: true }).click()
	await page.getByRole('button', { name: 'Rotate right' }).click()

	// The obfuscated block must rotate with the image: after a
	// clockwise turn its mixed pixels sit around the new center
	const result = await save(page)
	expect(result.width).toBe(100)
	expect(result.center[0]!).toBeGreaterThan(15)
	expect(result.center[2]!).toBeGreaterThan(15)
})

test('view zoom does not disturb crop application', async ({ page }) => {
	await waitLoaded(page)
	await page.locator('[data-test="zoom-in"]').click()

	await page.locator('[data-test="aspect-1:1"]').click()
	await page.locator('[data-test="apply-crop"]').click()

	const crop = (await readState(page)).crop
	expect(crop.width).toBe(crop.height)
	const result = await save(page)
	expect(result.width).toBe(crop.width)
})

test('escape leaves the crop mode without applying', async ({ page }) => {
	await waitLoaded(page)
	await expect(page.locator('[data-test="apply-crop"]')).toBeVisible()

	await page.keyboard.press('Escape')
	await expect(page.locator('[data-test="apply-crop"]')).not.toBeVisible()
	expect((await readState(page)).crop).toBeNull()
})
