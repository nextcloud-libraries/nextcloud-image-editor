/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type Konva from 'konva'

import { expect, test } from '@playwright/test'
import { drag, expectColor, imageTopLeft, readState, save, setInputValue, undo, waitLoaded } from './utils.ts'

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

	await undo(page)
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
	await expect(page.locator('[data-test="floating-toolbar"]')).toBeVisible()

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
	await expect(page.locator('[data-test="floating-toolbar"]')).toBeVisible()

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
	await expect(page.locator('[data-test="floating-toolbar"]')).toBeVisible()

	await setInputValue(page.locator('[data-test="toolbar-color"]'), '#00ff00')
	const state = await readState(page)
	expect(state.annotations[0].color).toBe('#00ff00')

	// One undo step returns the original color
	await undo(page)
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
	await expect(page.locator('[data-test="floating-toolbar"]')).toBeVisible()

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
	await expect(page.locator('[data-test="floating-toolbar"]')).toBeVisible()
	await expect(page.locator('[data-test="toolbar-color"]')).toHaveCount(0)
	await expect(page.getByText('Drag to move, use the handles to resize')).toBeVisible()

	// A redaction destroys pixels and stays axis-aligned: no color,
	// and no rotation handle either
	await page.keyboard.press('Delete')
	await page.getByRole('button', { name: 'Redact' }).click()
	await drag(page, { x: corner.x + 20, y: corner.y + 20 }, { x: corner.x + 90, y: corner.y + 70 })

	await page.getByRole('button', { name: 'Select' }).click()
	await page.mouse.click(corner.x + 55, corner.y + 45)
	await expect(page.locator('[data-test="floating-toolbar"]')).toBeVisible()
	await expect(page.locator('[data-test="toolbar-color"]')).toHaveCount(0)
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
	await expect(page.locator('[data-test="floating-toolbar"]')).toBeVisible()

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

test('picking a color records one undo step, not one per shade', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Annotate' }).click()
	await page.getByRole('button', { name: 'Rectangle' }).click()

	const corner = await imageTopLeft(page)
	await drag(page, { x: corner.x + 20, y: corner.y + 20 }, { x: corner.x + 80, y: corner.y + 60 })
	await page.getByRole('button', { name: 'Select' }).click()
	await page.mouse.click(corner.x + 50, corner.y + 20)

	// A native color picker reports every shade the pointer crosses
	const picker = page.locator('[data-test="toolbar-color"]')
	for (const shade of ['#00ff00', '#00dd00', '#00bb00', '#009900', '#007700']) {
		await picker.evaluate((element, value) => {
			const input = element as HTMLInputElement
			input.value = value
			input.dispatchEvent(new Event('input', { bubbles: true }))
		}, shade)
	}
	await picker.evaluate((element) => element.dispatchEvent(new Event('change', { bubbles: true })))

	await expect.poll(async () => (await readState(page)).annotations[0].color).toBe('#007700')

	// One undo returns to the original color rather than walking back
	// through every shade the pointer passed over
	await undo(page)
	await expect.poll(async () => (await readState(page)).annotations[0].color).toBe('#ff0000')
})

test('the line tool draws a straight stroke', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Annotate' }).click()
	await page.getByRole('button', { name: 'Line', exact: true }).click()
	await setInputValue(page.locator('[data-test="color"]'), '#00ff00')

	// Drag along the top of the fixture, wandering on the way: only the
	// ends should matter
	const corner = await imageTopLeft(page)
	await page.mouse.move(corner.x + 20, corner.y + 50)
	await page.mouse.down()
	await page.mouse.move(corner.x + 60, corner.y + 10, { steps: 4 })
	await page.mouse.move(corner.x + 180, corner.y + 50, { steps: 4 })
	await page.mouse.up()

	const { annotations } = await readState(page)
	expect(annotations).toHaveLength(1)
	expect(annotations[0].type).toBe('line')
	expect(annotations[0].points).toHaveLength(4)

	// The midpoint of the drawn line lands on the fixture's centre
	const result = await save(page)
	expectColor(result.center, [0, 255, 0], 60)
})

test('a line survives a rotation in the export', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Annotate' }).click()
	await page.getByRole('button', { name: 'Line', exact: true }).click()

	const corner = await imageTopLeft(page)
	await drag(page, { x: corner.x + 20, y: corner.y + 50 }, { x: corner.x + 180, y: corner.y + 50 })
	const before = (await readState(page)).annotations[0].points

	await page.getByRole('button', { name: 'Crop', exact: true }).click()
	await page.getByRole('button', { name: 'Rotate right' }).click()
	await expect.poll(async () => (await readState(page)).rotation).toBe(90)

	// Both ends moved into the rotated frame rather than staying put
	const after = (await readState(page)).annotations[0].points
	expect(after).not.toEqual(before)
	const result = await save(page)
	expect(result.width).toBe(100)
	expect(result.height).toBe(200)
})

test('text can carry a contrasting edge, and remembers it in the state', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Annotate' }).click()
	await page.getByRole('button', { name: 'Text', exact: true }).click()

	const corner = await imageTopLeft(page)
	await drag(page, { x: corner.x + 30, y: corner.y + 30 }, { x: corner.x + 150, y: corner.y + 60 })
	await page.waitForTimeout(300)
	// The switch floats next to the field, and the overlay shows the edge
	// while it is being typed, not only after
	await page.locator('[data-test="toolbar-outline"]').click()
	const overlay = page.locator('[data-test="text-overlay"]')
	// The browser normalises 'stroke fill' to 'stroke', the rest being implied
	await expect(overlay).toHaveCSS('paint-order', 'stroke')
	await expect(overlay).toHaveCSS('-webkit-text-stroke-color', 'rgb(255, 255, 255)')
	await page.keyboard.type('caption')
	await page.mouse.click(corner.x + 260, corner.y + 200)
	await page.waitForTimeout(300)

	const state = await readState(page)
	const text = state.annotations.find((a: { type: string }) => a.type === 'text')
	expect(text.outline).toBe(true)
})

test('text without the edge records that too', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Annotate' }).click()
	await page.getByRole('button', { name: 'Text', exact: true }).click()

	const corner = await imageTopLeft(page)
	await drag(page, { x: corner.x + 30, y: corner.y + 30 }, { x: corner.x + 150, y: corner.y + 60 })
	await page.waitForTimeout(300)
	await page.keyboard.type('plain')
	await page.mouse.click(corner.x + 260, corner.y + 200)
	await page.waitForTimeout(300)

	const state = await readState(page)
	const text = state.annotations.find((a: { type: string }) => a.type === 'text')
	expect(text.outline).toBe(false)
})

test('a caption can be restyled after it is placed', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Annotate' }).click()
	await page.getByRole('button', { name: 'Text', exact: true }).click()

	const corner = await imageTopLeft(page)
	await drag(page, { x: corner.x + 30, y: corner.y + 30 }, { x: corner.x + 150, y: corner.y + 60 })
	await page.waitForTimeout(300)
	await page.keyboard.type('caption')
	await page.mouse.click(corner.x + 260, corner.y + 200)
	await page.waitForTimeout(300)

	const placed = await readState(page)
	const id = placed.annotations.find((a: { type: string }) => a.type === 'text').id
	expect(placed.annotations.find((a: { id: string }) => a.id === id).outline).toBe(false)

	// Select it, the way someone would after seeing it is unreadable
	await page.getByRole('button', { name: 'Select', exact: true }).click()
	await page.mouse.click(corner.x + 40, corner.y + 40)
	await page.waitForTimeout(300)

	// The switches follow the selection, so they are reachable from the
	// select tool where the annotate panel is not
	const outline = page.locator('[data-test="toolbar-outline"]')
	await expect(outline).toBeVisible()
	await outline.click()
	await page.waitForTimeout(300)

	const styled = await readState(page)
	expect(styled.annotations.find((a: { id: string }) => a.id === id).outline).toBe(true)

	// And it is one undoable step, not a silent change
	await undo(page)
	const undone = await readState(page)
	expect(undone.annotations.find((a: { id: string }) => a.id === id).outline).toBe(false)
})

test('text can be set in another family, and the overlay matches', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Annotate' }).click()
	await page.getByRole('button', { name: 'Text', exact: true }).click()

	const corner = await imageTopLeft(page)
	await drag(page, { x: corner.x + 30, y: corner.y + 30 }, { x: corner.x + 150, y: corner.y + 60 })
	await page.waitForTimeout(300)
	await page.locator('[data-test="toolbar-font"] button').click()
	await page.locator('[data-test="toolbar-font-serif"]').click()
	// The menu closes on its own and hands the caret back
	await expect(page.locator('[data-test="toolbar-font-serif"]')).toHaveCount(0)
	await expect(page.locator('[data-test="text-overlay"]')).toBeFocused()

	// The overlay is the only preview there is, so it has to be the same
	// stack the canvas draws, not merely a serif of its own choosing
	await expect(page.locator('[data-test="text-overlay"]'))
		.toHaveCSS('font-family', 'Georgia, "Times New Roman", serif')

	await page.keyboard.type('caption')
	await page.mouse.click(corner.x + 260, corner.y + 200)
	await page.waitForTimeout(300)

	const state = await readState(page)
	expect(state.annotations.find((a: { type: string }) => a.type === 'text').font).toBe('serif')
})

test('the family of a placed caption can be changed from the selection', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Annotate' }).click()
	await page.getByRole('button', { name: 'Text', exact: true }).click()

	const corner = await imageTopLeft(page)
	await drag(page, { x: corner.x + 30, y: corner.y + 30 }, { x: corner.x + 150, y: corner.y + 60 })
	await page.waitForTimeout(300)
	await page.keyboard.type('caption')
	await page.mouse.click(corner.x + 260, corner.y + 200)
	await page.waitForTimeout(300)

	await page.getByRole('button', { name: 'Select', exact: true }).click()
	await page.mouse.click(corner.x + 40, corner.y + 40)
	await page.waitForTimeout(300)

	await page.locator('[data-test="toolbar-font"] button').click()
	await page.locator('[data-test="toolbar-font-mono"]').click()
	await page.waitForTimeout(300)

	const state = await readState(page)
	expect(state.annotations.find((a: { type: string }) => a.type === 'text').font).toBe('mono')
})

test('text can be aligned, and the overlay matches', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Annotate' }).click()
	await page.getByRole('button', { name: 'Text', exact: true }).click()

	const corner = await imageTopLeft(page)
	await drag(page, { x: corner.x + 30, y: corner.y + 30 }, { x: corner.x + 150, y: corner.y + 60 })
	await page.waitForTimeout(300)
	await page.locator('[data-test="toolbar-align"] button').click()
	await page.locator('[data-test="toolbar-align-right"]').click()
	await expect(page.locator('[data-test="toolbar-align-right"]')).toHaveCount(0)

	await expect(page.locator('[data-test="text-overlay"]')).toHaveCSS('text-align', 'right')

	await page.keyboard.type('caption')
	await page.mouse.click(corner.x + 260, corner.y + 200)
	await page.waitForTimeout(300)

	const state = await readState(page)
	expect(state.annotations.find((a: { type: string }) => a.type === 'text').align).toBe('right')
})

test('the alignment of a placed caption can be changed from the selection', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Annotate' }).click()
	await page.getByRole('button', { name: 'Text', exact: true }).click()

	const corner = await imageTopLeft(page)
	await drag(page, { x: corner.x + 30, y: corner.y + 30 }, { x: corner.x + 150, y: corner.y + 60 })
	await page.waitForTimeout(300)
	await page.keyboard.type('caption')
	await page.mouse.click(corner.x + 260, corner.y + 200)
	await page.waitForTimeout(300)

	await page.getByRole('button', { name: 'Select', exact: true }).click()
	await page.mouse.click(corner.x + 40, corner.y + 40)
	await page.waitForTimeout(300)

	await page.locator('[data-test="toolbar-align"] button').click()
	await page.locator('[data-test="toolbar-align-center"]').click()
	await page.waitForTimeout(300)

	const state = await readState(page)
	expect(state.annotations.find((a: { type: string }) => a.type === 'text').align).toBe('center')

	// One undoable step, like the other styling controls. New text is
	// created carrying the tool default, so undo returns it to that
	await undo(page)
	const undone = await readState(page)
	expect(undone.annotations.find((a: { type: string }) => a.type === 'text').align).toBe('left')
})

test('text can be emphasised, and the overlay matches', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Annotate' }).click()
	await page.getByRole('button', { name: 'Text', exact: true }).click()

	const corner = await imageTopLeft(page)
	await drag(page, { x: corner.x + 30, y: corner.y + 30 }, { x: corner.x + 150, y: corner.y + 60 })
	await page.waitForTimeout(300)
	await page.locator('[data-test="toolbar-bold"]').click()
	await page.locator('[data-test="toolbar-italic"]').click()
	await page.locator('[data-test="toolbar-underline"]').click()
	await page.locator('[data-test="toolbar-strikethrough"]').click()
	// Plain buttons leave the caret where it was
	await expect(page.locator('[data-test="text-overlay"]')).toBeFocused()

	// The overlay is the only preview there is, so it has to be cut the
	// way the canvas will draw it
	const overlay = page.locator('[data-test="text-overlay"]')
	await expect(overlay).toHaveCSS('font-weight', '700')
	await expect(overlay).toHaveCSS('font-style', 'italic')
	await expect(overlay).toHaveCSS('text-decoration-line', 'underline line-through')

	await page.keyboard.type('caption')
	await page.mouse.click(corner.x + 260, corner.y + 200)
	await page.waitForTimeout(300)

	const state = await readState(page)
	const text = state.annotations.find((a: { type: string }) => a.type === 'text')
	expect(text).toMatchObject({ bold: true, italic: true, underline: true, strikethrough: true })

	// And the canvas draws what the state says
	const drawn = await page.evaluate(() => {
		const node = window.Konva.stages[0]!.findOne<Konva.Text>('Text')!
		return { fontStyle: node.fontStyle(), textDecoration: node.textDecoration() }
	})
	expect(drawn).toEqual({ fontStyle: 'italic bold', textDecoration: 'underline line-through' })
})

test('the toolbar floats over the text being typed, and recolors it', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Annotate' }).click()
	await page.getByRole('button', { name: 'Text', exact: true }).click()

	// Nothing to hang off before the field opens
	const toolbar = page.locator('[data-test="floating-toolbar"]')
	await expect(toolbar).toHaveCount(0)

	const corner = await imageTopLeft(page)
	await drag(page, { x: corner.x + 30, y: corner.y + 80 }, { x: corner.x + 150, y: corner.y + 110 })
	await page.waitForTimeout(300)
	await expect(toolbar).toBeVisible()
	// Nothing placed yet, so nothing to duplicate or delete
	await expect(page.locator('[data-test="duplicate"]')).toHaveCount(0)

	// Above the field, centred on it
	const overlay = page.locator('[data-test="text-overlay"]')
	const field = (await overlay.boundingBox())!
	const bar = (await toolbar.boundingBox())!
	expect(bar.y + bar.height).toBeLessThan(field.y)
	expect(Math.abs(bar.x + bar.width / 2 - (field.x + field.width / 2))).toBeLessThan(2)

	await setInputValue(page.locator('[data-test="toolbar-color"]'), '#00ff00')
	await expect(overlay).toHaveCSS('color', 'rgb(0, 255, 0)')
	await expect(overlay).toBeFocused()

	await page.keyboard.type('green')
	await page.keyboard.press('Enter')
	await page.waitForTimeout(300)

	const state = await readState(page)
	expect(state.annotations.find((a: { type: string }) => a.type === 'text').color).toBe('#00ff00')
	// The bar leaves with the field
	await expect(toolbar).toHaveCount(0)
})

test('a placed caption can be made bold from the selection', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Annotate' }).click()
	await page.getByRole('button', { name: 'Text', exact: true }).click()

	const corner = await imageTopLeft(page)
	await drag(page, { x: corner.x + 30, y: corner.y + 30 }, { x: corner.x + 150, y: corner.y + 60 })
	await page.waitForTimeout(300)
	await page.keyboard.type('caption')
	await page.mouse.click(corner.x + 260, corner.y + 200)
	await page.waitForTimeout(300)

	const placed = await readState(page)
	const id = placed.annotations.find((a: { type: string }) => a.type === 'text').id
	expect(placed.annotations.find((a: { id: string }) => a.id === id).bold).toBe(false)

	await page.getByRole('button', { name: 'Select', exact: true }).click()
	await page.mouse.click(corner.x + 40, corner.y + 40)
	await page.waitForTimeout(300)

	const bold = page.locator('[data-test="toolbar-bold"]')
	await expect(bold).toBeVisible()
	await bold.click()
	await page.waitForTimeout(300)

	const styled = await readState(page)
	expect(styled.annotations.find((a: { id: string }) => a.id === id).bold).toBe(true)
	await expect(bold).toHaveAttribute('aria-pressed', 'true')

	// One undoable step, like the other styling controls
	await undo(page)
	const undone = await readState(page)
	expect(undone.annotations.find((a: { id: string }) => a.id === id).bold).toBe(false)
})

test('a redaction obfuscates what was drawn under it', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Annotate' }).click()
	await page.getByRole('button', { name: 'Draw', exact: true }).click()
	await setInputValue(page.locator('input[type="color"]'), '#00ff00')

	const corner = await imageTopLeft(page)
	// Along the bottom-left, which the fixture leaves solid red, so the
	// mark is the only green there is
	await drag(page, { x: corner.x + 2, y: corner.y + 97 }, { x: corner.x + 40, y: corner.y + 97 })
	await page.waitForTimeout(300)
	const drawn = await save(page)
	expect(drawn.bottomLeft[1]).toBeGreaterThan(100)

	await page.getByRole('button', { name: 'Redact', exact: true }).click()
	await drag(page, { x: corner.x - 10, y: corner.y + 80 }, { x: corner.x + 45, y: corner.y + 110 })
	await page.waitForTimeout(300)

	// Sampling the source image leaves the mark untouched under the
	// patch, which exports the very pixels the redaction claimed to hide
	const redacted = await save(page)
	expect(redacted.bottomLeft).not.toEqual(drawn.bottomLeft)
})

test('a redaction obfuscates the picture as adjusted, not as loaded', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Adjust' }).click()
	await page.locator('[data-test="tab-brightness"]').click()
	await setInputValue(page.locator('[data-test="adjust-brightness"]'), '-50')
	const adjusted = await save(page)
	expect(adjusted.center[2]).toBeLessThan(100)

	await page.getByRole('button', { name: 'Redact', exact: true }).click()
	const corner = await imageTopLeft(page)
	// Across the color boundary, so the center block is half of each and
	// the region is not the flat color that pixelation cannot change
	await drag(page, { x: corner.x + 58, y: corner.y + 20 }, { x: corner.x + 138, y: corner.y + 80 })
	await page.waitForTimeout(300)

	// Half of the darkened 72 in each channel. The adjustments live on
	// the image node rather than in the source the patch is built from,
	// so sampling the source exports half of the original 200 instead
	const redacted = await save(page)
	expect(redacted.center[0]).toBeLessThan(60)
	expect(redacted.center[2]).toBeLessThan(60)
})

test('an oval redaction leaves the corners of its box alone', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Annotate' }).click()
	await page.getByRole('button', { name: 'Draw', exact: true }).click()
	await setInputValue(page.locator('input[type="color"]'), '#00ff00')

	const corner = await imageTopLeft(page)
	// A mark in the bottom-left corner, which falls inside the box drawn
	// below but outside the oval inscribed in it
	await drag(page, { x: corner.x + 2, y: corner.y + 97 }, { x: corner.x + 20, y: corner.y + 97 })
	await page.waitForTimeout(300)
	const drawn = await save(page)

	await page.getByRole('button', { name: 'Redact', exact: true }).click()
	await page.locator('[data-test="redact-ellipse"]').click()
	await drag(page, { x: corner.x, y: corner.y + 40 }, { x: corner.x + 90, y: corner.y + 110 })
	await page.waitForTimeout(300)

	const state = await readState(page)
	expect(state.annotations[1].shape).toBe('ellipse')

	// An oval that obfuscated its whole box would be no better than the
	// rectangle it replaces
	const redacted = await save(page)
	expect(redacted.bottomLeft).toEqual(drawn.bottomLeft)
})

test('an oval redaction still destroys what it covers', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Redact', exact: true }).click()
	await page.locator('[data-test="redact-ellipse"]').click()

	const corner = await imageTopLeft(page)
	// Centered on the color boundary, so the middle of the oval averages
	// red and blue instead of staying either
	await drag(page, { x: corner.x + 58, y: corner.y + 20 }, { x: corner.x + 142, y: corner.y + 80 })
	await page.waitForTimeout(300)

	const result = await save(page)
	expect(result.center[0]).toBeGreaterThan(20)
	expect(result.center[2]).toBeGreaterThan(20)
})
