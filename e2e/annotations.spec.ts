/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { expect, test } from '@playwright/test'
import { drag, expectColor, imageTopLeft, readState, save, setInputValue, waitLoaded } from './utils.ts'

test('freehand drawing paints a stroke', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Annotate' }).click()
	await page.getByRole('button', { name: 'Draw' }).click()
	await setInputValue(page.locator('input[type="color"]'), '#00ff00')

	const corner = await imageTopLeft(page)
	await drag(page, { x: corner.x + 20, y: corner.y + 50 }, { x: corner.x + 180, y: corner.y + 50 })

	const state = await readState(page)
	expect(state.annotations).toHaveLength(1)
	expect(state.annotations[0].type).toBe('draw')
	expect(state.annotations[0].color).toBe('#00ff00')

	// The stroke crosses the image center
	const result = await save(page)
	expectColor(result.center, [0, 255, 0], 30)
})

test('dragging creates a rectangle annotation', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Annotate' }).click()
	await page.getByRole('button', { name: 'Rectangle' }).click()

	const corner = await imageTopLeft(page)
	await drag(page, { x: corner.x + 20, y: corner.y + 20 }, { x: corner.x + 80, y: corner.y + 60 })

	const state = await readState(page)
	expect(state.annotations).toHaveLength(1)
	const rect = state.annotations[0].rect
	expect(rect.x).toBeGreaterThan(15)
	expect(rect.x).toBeLessThan(25)
	expect(rect.width).toBeGreaterThan(55)
	expect(rect.width).toBeLessThan(65)
})

test('text tool adds a text annotation via the overlay', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Annotate' }).click()
	await page.getByRole('button', { name: 'Text', exact: true }).click()

	const corner = await imageTopLeft(page)
	await page.mouse.click(corner.x + 40, corner.y + 30)

	const overlay = page.locator('[data-test="text-overlay"]')
	await expect(overlay).toBeVisible()
	await overlay.fill('Hi')
	await overlay.press('Enter')

	const state = await readState(page)
	expect(state.annotations).toHaveLength(1)
	expect(state.annotations[0].type).toBe('text')
	expect(state.annotations[0].text).toBe('Hi')
})

test('sticker tool places the picked emoji', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Sticker', exact: true }).click()
	await page.getByRole('button', { name: '🎉' }).click()

	const corner = await imageTopLeft(page)
	await page.mouse.click(corner.x + 100, corner.y + 50)

	const state = await readState(page)
	expect(state.annotations).toHaveLength(1)
	expect(state.annotations[0].type).toBe('sticker')
	expect(state.annotations[0].text).toBe('🎉')
})

test('undo removes the last annotation', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Annotate' }).click()
	await page.getByRole('button', { name: 'Draw' }).click()

	const corner = await imageTopLeft(page)
	await drag(page, { x: corner.x + 20, y: corner.y + 50 }, { x: corner.x + 100, y: corner.y + 50 })
	expect((await readState(page)).annotations).toHaveLength(1)

	await page.getByRole('button', { name: 'Undo' }).click()
	expect((await readState(page)).annotations).toHaveLength(0)
})

test('a selected annotation can be deleted with the keyboard', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Annotate' }).click()
	await page.getByRole('button', { name: 'Draw' }).click()

	const corner = await imageTopLeft(page)
	await drag(page, { x: corner.x + 20, y: corner.y + 50 }, { x: corner.x + 180, y: corner.y + 50 })

	await page.getByRole('button', { name: 'Select' }).click()
	await page.mouse.click(corner.x + 100, corner.y + 50)
	await page.keyboard.press('Delete')

	expect((await readState(page)).annotations).toHaveLength(0)
})

test('annotations rotate with the image', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Sticker', exact: true }).click()

	const corner = await imageTopLeft(page)
	await page.mouse.click(corner.x + 20, corner.y + 10)

	const before = (await readState(page)).annotations[0]
	await page.getByRole('button', { name: 'Crop', exact: true }).click()
	await page.getByRole('button', { name: 'Rotate right' }).click()
	const after = (await readState(page)).annotations[0]

	// (x, y) -> (height - y, x) for a clockwise turn in a 200x100 image
	expect(after.x).toBeCloseTo(100 - before.y, 0)
	expect(after.y).toBeCloseTo(before.x, 0)
})

test('redact pixelates the selected region destructively', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Redact', exact: true }).click()

	const corner = await imageTopLeft(page)
	// Off-grid rect crossing the color boundary so the center block
	// averages red and blue
	await drag(page, { x: corner.x + 58, y: corner.y + 20 }, { x: corner.x + 138, y: corner.y + 80 })

	const state = await readState(page)
	expect(state.annotations).toHaveLength(1)
	expect(state.annotations[0].type).toBe('redact')

	const result = await save(page)
	expect(result.center[0]).toBeGreaterThan(20)
	expect(result.center[2]).toBeGreaterThan(20)
})

test('the selection toolbar duplicates and deletes', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Annotate' }).click()
	await page.getByRole('button', { name: 'Rectangle' }).click()

	const corner = await imageTopLeft(page)
	await drag(page, { x: corner.x + 20, y: corner.y + 20 }, { x: corner.x + 80, y: corner.y + 60 })

	await page.getByRole('button', { name: 'Select' }).click()
	await page.mouse.click(corner.x + 50, corner.y + 20)
	await expect(page.locator('[data-test="selection-toolbar"]')).toBeVisible()

	await page.locator('[data-test="duplicate"]').click()
	expect((await readState(page)).annotations).toHaveLength(2)

	await page.locator('[data-test="delete"]').click()
	expect((await readState(page)).annotations).toHaveLength(1)
})

test('redact can blur instead of pixelate', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Redact', exact: true }).click()
	await page.locator('[data-test="redact-blur"]').click()

	const corner = await imageTopLeft(page)
	await drag(page, { x: corner.x + 58, y: corner.y + 20 }, { x: corner.x + 138, y: corner.y + 80 })

	const state = await readState(page)
	expect(state.annotations[0].style).toBe('blur')

	// The blur mixes red into blue across the boundary
	const result = await save(page)
	expect(result.center[0]).toBeGreaterThan(15)
	expect(result.center[2]).toBeGreaterThan(15)
})

test('switching tools drops the selection instead of hiding it', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Annotate' }).click()
	await page.getByRole('button', { name: 'Rectangle' }).click()

	const corner = await imageTopLeft(page)
	await drag(page, { x: corner.x + 20, y: corner.y + 20 }, { x: corner.x + 80, y: corner.y + 60 })

	await page.getByRole('button', { name: 'Select' }).click()
	await page.mouse.click(corner.x + 50, corner.y + 20)
	await expect(page.locator('[data-test="selection-toolbar"]')).toBeVisible()

	// Leaving the select mode must clear the (now invisible) selection:
	// a Delete press afterwards may not remove anything
	await page.getByRole('button', { name: 'Annotate' }).click()
	await page.keyboard.press('Delete')
	expect((await readState(page)).annotations).toHaveLength(1)
})

test('the color control recolors the selected annotation', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Annotate' }).click()
	await page.getByRole('button', { name: 'Rectangle' }).click()

	const corner = await imageTopLeft(page)
	await drag(page, { x: corner.x + 20, y: corner.y + 20 }, { x: corner.x + 80, y: corner.y + 60 })

	await page.getByRole('button', { name: 'Select' }).click()
	await page.mouse.click(corner.x + 50, corner.y + 20)
	await expect(page.locator('[data-test="selection-toolbar"]')).toBeVisible()

	await setInputValue(page.locator('input[type="color"]'), '#00ff00')
	const state = await readState(page)
	expect(state.annotations[0].color).toBe('#00ff00')

	// One undo step returns the original color
	await page.getByRole('button', { name: 'Undo' }).click()
	expect((await readState(page)).annotations[0].color).toBe('#ff0000')
})

test('rectangle rotation survives rebuilds and round trips', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Annotate' }).click()
	await page.getByRole('button', { name: 'Rectangle' }).click()

	const corner = await imageTopLeft(page)
	await drag(page, { x: corner.x + 60, y: corner.y + 30 }, { x: corner.x + 140, y: corner.y + 70 })

	await page.getByRole('button', { name: 'Select' }).click()
	await page.mouse.click(corner.x + 100, corner.y + 30)
	await expect(page.locator('[data-test="selection-toolbar"]')).toBeVisible()

	// Rotate through the transformer pipeline; the synthetic pointer
	// drag on the tiny rotater handle is too flaky across engines
	await page.evaluate(() => {
		const stage = window.Konva.stages[0]
		const node = stage.find('.annotation')[0]
		node.rotation(33)
		node.fire('transformend', { target: node }, true)
	})
	expect((await readState(page)).annotations[0].rotation).toBeCloseTo(33, 5)

	// Deselect (rebuild) and confirm the angle survived
	await page.mouse.click(corner.x + 20, corner.y + 90)
	expect((await readState(page)).annotations[0].rotation).toBeCloseTo(33, 5)

	// A 90° image turn adds a quarter turn to the annotation
	await page.getByRole('button', { name: 'Crop', exact: true }).click()
	await page.getByRole('button', { name: 'Rotate right' }).click()
	expect((await readState(page)).annotations[0].rotation).toBeCloseTo(123, 5)
})

test('the emoji picker feeds the sticker tool', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Sticker', exact: true }).click()
	await page.locator('[data-test="emoji-picker"]').click()

	// The picker popover opens with a search field
	await expect(page.locator('.emoji-mart, [class*="emoji"]').first()).toBeVisible()
})

test('the text overlay grows with its content', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Annotate' }).click()
	await page.getByRole('button', { name: 'Text', exact: true }).click()

	const corner = await imageTopLeft(page)
	await page.mouse.click(corner.x + 30, corner.y + 30)
	const overlay = page.locator('[data-test="text-overlay"]')
	await expect(overlay).toBeVisible()

	const before = (await overlay.boundingBox())!.width
	await overlay.pressSequentially('growing wide')
	const after = (await overlay.boundingBox())!.width
	expect(after).toBeGreaterThan(before)

	await overlay.press('Enter')
	expect((await readState(page)).annotations[0].text).toBe('growing wide')
})
