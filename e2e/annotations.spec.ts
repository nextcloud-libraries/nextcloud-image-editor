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
	// The quick row is the user's frequently used emojis: pick the
	// second entry dynamically instead of assuming its value
	const chip = page.locator('.sticker-panel button').nth(1)
	const emoji = (await chip.innerText()).trim()
	await chip.click()

	const corner = await imageTopLeft(page)
	await page.mouse.click(corner.x + 100, corner.y + 50)

	const state = await readState(page)
	expect(state.annotations).toHaveLength(1)
	expect(state.annotations[0].type).toBe('sticker')
	expect(state.annotations[0].text).toBe(emoji)
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

test('blur redaction falls back to pixelation without canvas filter support', async ({ page }) => {
	// Emulate an engine that ignores the 2D context filter property, as
	// WebKit did before Safari 18. The region must still be destroyed:
	// drawing it untouched would export the pixels the user redacted.
	await page.addInitScript(() => {
		Object.defineProperty(CanvasRenderingContext2D.prototype, 'filter', {
			configurable: true,
			get: () => 'none',
			set: () => {},
		})
	})
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Redact', exact: true }).click()
	await page.locator('[data-test="redact-blur"]').click()

	const corner = await imageTopLeft(page)
	await drag(page, { x: corner.x + 58, y: corner.y + 20 }, { x: corner.x + 138, y: corner.y + 80 })

	expect((await readState(page)).annotations[0].style).toBe('blur')

	// The fixture boundary sits on the probed center pixel: pixelation
	// averages red into blue there, an untouched copy stays pure blue
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

test('freehand strokes scale and rotate through the transformer', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Annotate' }).click()
	await page.getByRole('button', { name: 'Draw' }).click()

	const corner = await imageTopLeft(page)
	await drag(page, { x: corner.x + 20, y: corner.y + 50 }, { x: corner.x + 100, y: corner.y + 50 })
	const before = (await readState(page)).annotations[0]

	await page.getByRole('button', { name: 'Select' }).click()
	await page.mouse.click(corner.x + 60, corner.y + 50)
	await expect(page.locator('[data-test="selection-toolbar"]')).toBeVisible()

	// Strokes expose the full transformer, rotation handle included
	const handles = await page.evaluate(() => {
		const transformer = window.Konva.stages[0].find('Transformer')[0] as unknown as { resizeEnabled(): boolean, rotateEnabled(): boolean }
		return { resize: transformer.resizeEnabled(), rotate: transformer.rotateEnabled() }
	})
	expect(handles).toEqual({ resize: true, rotate: true })

	// Apply scale and rotation through the transformer pipeline; the
	// synthetic anchor drag is too flaky across engines
	await page.evaluate(() => {
		const stage = window.Konva.stages[0]
		const node = stage.find('.annotation')[0]
		node.scaleX(2)
		node.scaleY(2)
		node.rotation(90)
		node.fire('transformend', { target: node }, true)
	})

	const after = (await readState(page)).annotations[0]
	expect(after.points).toHaveLength(before.points.length)
	expect(after.strokeWidth).toBeCloseTo(before.strokeWidth * 2, 5)

	// The quarter turn maps the horizontal stroke onto a vertical one:
	// all x values collapse while the y span doubles
	const xs = after.points.filter((_: number, i: number) => i % 2 === 0)
	const ys = after.points.filter((_: number, i: number) => i % 2 === 1)
	expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(1)
	const beforeXs = before.points.filter((_: number, i: number) => i % 2 === 0)
	expect(Math.max(...ys) - Math.min(...ys))
		.toBeCloseTo((Math.max(...beforeXs) - Math.min(...beforeXs)) * 2, 3)

	// The folded stroke survives a rebuild (deselect renders from state)
	await page.mouse.click(corner.x + 10, corner.y + 90)
	expect((await readState(page)).annotations[0].points).toEqual(after.points)
})

test('the color control hides where color has no effect', async ({ page }) => {
	await waitLoaded(page)

	// A sticker shows the emoji glyph: no color to edit
	await page.getByRole('button', { name: 'Sticker', exact: true }).click()
	await page.locator('.sticker-panel button').nth(1).click()
	const corner = await imageTopLeft(page)
	await page.mouse.click(corner.x + 100, corner.y + 50)

	await page.getByRole('button', { name: 'Select' }).click()
	await page.mouse.click(corner.x + 112, corner.y + 62)
	await expect(page.locator('[data-test="selection-toolbar"]')).toBeVisible()
	await expect(page.locator('.select-panel input[type="color"]')).toHaveCount(0)
	await expect(page.getByText('Drag to move, use the handles to resize')).toBeVisible()

	// A redaction destroys pixels and stays axis-aligned: no color,
	// and no rotation handle either
	await page.keyboard.press('Delete')
	await page.getByRole('button', { name: 'Redact' }).click()
	await drag(page, { x: corner.x + 20, y: corner.y + 20 }, { x: corner.x + 90, y: corner.y + 70 })

	await page.getByRole('button', { name: 'Select' }).click()
	await page.mouse.click(corner.x + 55, corner.y + 45)
	await expect(page.locator('[data-test="selection-toolbar"]')).toBeVisible()
	await expect(page.locator('.select-panel input[type="color"]')).toHaveCount(0)
	const rotatable = await page.evaluate(() => {
		const transformer = window.Konva.stages[0].find('Transformer')[0] as unknown as { rotateEnabled(): boolean }
		return transformer.rotateEnabled()
	})
	expect(rotatable).toBe(false)
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

test('a stroke released over the controls is still committed', async ({ page }) => {
	await waitLoaded(page, 'large')
	await page.getByRole('button', { name: 'Annotate' }).click()
	await page.getByRole('button', { name: 'Draw', exact: true }).click()

	const canvas = (await page.locator('.image-editor__canvas').boundingBox())!
	const card = (await page.locator('.editor-card').boundingBox())!

	await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + 120)
	await page.mouse.down()
	await page.mouse.move(canvas.x + canvas.width / 2 + 60, canvas.y + 180, { steps: 5 })
	// The floating control card is not the Konva container, so the
	// release never reaches the stage
	await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2, { steps: 5 })
	await page.mouse.up()

	const { annotations } = await readState(page)
	expect(annotations).toHaveLength(1)
	expect(annotations[0].type).toBe('draw')
})
