/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { expect, test } from '@playwright/test'
import { drag, expectColor, imageTopLeft, save, setInputValue, waitLoaded } from './utils.ts'

test('renders the canvas stage and chrome', async ({ page }) => {
	await waitLoaded(page)
	await expect(page.getByRole('button', { name: 'Cancel' })).toBeEnabled()
	for (const mode of ['Crop', 'Adjust', 'Filter', 'Annotate', 'Sticker']) {
		await expect(page.getByRole('button', { name: mode, exact: true })).toBeEnabled()
	}
	await expect(page.locator('[role="img"] canvas').first()).toBeVisible()
})

test('emits cancel', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Cancel' }).click()
	await expect(page.locator('[data-test="cancelled"]')).toHaveText('1')
})

test('exports the unedited image faithfully', async ({ page }) => {
	await waitLoaded(page)
	const result = await save(page)

	expect(result.mimeType).toBe('image/png')
	expect(result.width).toBe(200)
	expect(result.height).toBe(100)
	expectColor(result.topLeft, [200, 0, 0])
	expectColor(result.topRight, [0, 0, 200])
})

test('emits error for an undecodable source', async ({ page }) => {
	await page.goto('/?src=broken')
	await expect(page.locator('[data-test="errors"]')).toHaveText('Image could not be decoded')
	await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled()
})

test('a failed load says so and offers another attempt', async ({ page }) => {
	await page.goto('/?src=broken')

	// An empty frame with a stopped spinner leaves the user nowhere
	await expect(page.locator('[data-test="load-error"]')).toBeVisible()
	await expect(page.locator('.image-editor__loading')).toBeHidden()

	await page.locator('[data-test="retry"]').click()

	// The same source fails again, and the editor says so again rather
	// than getting stuck on the attempt
	await expect(page.locator('[data-test="errors"]'))
		.toHaveText('Image could not be decoded, Image could not be decoded')
	await expect(page.locator('[data-test="load-error"]')).toBeVisible()
})

test('a successful load leaves no failure behind', async ({ page }) => {
	await waitLoaded(page)
	await expect(page.locator('[data-test="load-error"]')).toBeHidden()
})

test('view zoom magnifies without touching the edit state', async ({ page }) => {
	await waitLoaded(page)
	await expect(page.locator('[data-test="zoom-out"]')).toBeDisabled()

	await page.locator('[data-test="zoom-in"]').click()
	await expect(page.locator('[data-test="zoom-out"]')).toBeEnabled()

	// Purely a view concern: the state and the export stay untouched
	const result = await save(page)
	expect(result.width).toBe(200)
	expect(result.height).toBe(100)
})

test('adapts to a phone-sized container', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 })
	await waitLoaded(page)

	// No horizontal overflow, all modes reachable, saving still works
	const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
	expect(overflow).toBe(0)

	for (const mode of ['Crop', 'Adjust', 'Filter', 'Annotate', 'Sticker', 'Redact']) {
		await expect(page.getByRole('button', { name: mode, exact: true })).toBeEnabled()
	}

	const result = await save(page)
	expect(result.width).toBe(200)
	expect(result.height).toBe(100)
})

test('view zoom actually magnifies the stage content', async ({ page }) => {
	await waitLoaded(page)

	const scaleOf = () => page.evaluate(() => {
		const stage = window.Konva.stages[0]
		return stage.findOne('.view').scaleX()
	})
	const before = await scaleOf()
	await page.locator('[data-test="zoom-in"]').click()
	const after = await scaleOf()
	expect(after).toBeGreaterThan(before * 1.4)
})

test('the zoom readout resets the view to 100%', async ({ page }) => {
	await waitLoaded(page)
	await page.locator('[data-test="zoom-in"]').click()
	await page.locator('[data-test="zoom-in"]').click()
	await expect(page.locator('[data-test="zoom-reset"]')).not.toHaveText('100%')

	await page.locator('[data-test="zoom-reset"]').click()
	await expect(page.locator('[data-test="zoom-reset"]')).toHaveText('100%')
	await expect(page.locator('[data-test="zoom-out"]')).toBeDisabled()
})

test('phone layout keeps the rail and controls apart', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 640 })
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Annotate' }).click()

	const rail = await page.locator('.image-editor__rail').boundingBox()
	const controls = await page.locator('.image-editor__controls').boundingBox()
	expect(rail).not.toBeNull()
	expect(controls).not.toBeNull()
	// No vertical intersection between the floating chrome pieces
	expect(rail!.y + rail!.height).toBeLessThanOrEqual(controls!.y + 1)

	// The top bar must not overflow horizontally
	const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
	expect(overflow).toBe(0)
})

test('state changes are announced to assistive tech', async ({ page }) => {
	await waitLoaded(page)
	const live = page.locator('[role="status"][aria-live]')

	await page.getByRole('button', { name: 'Annotate' }).click()
	await expect(live).toContainText('mode')

	await page.getByRole('button', { name: 'Filter', exact: true }).click()
	await page.locator('[data-test="preset-sepia"]').click()
	await expect(live).toHaveText('Filter applied')
})

test('the scene reconciles instead of rebuilding', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Annotate' }).click()
	await page.getByRole('button', { name: 'Draw' }).click()

	const corner = await imageTopLeft(page)
	await drag(page, { x: corner.x + 20, y: corner.y + 30 }, { x: corner.x + 100, y: corner.y + 30 })
	await drag(page, { x: corner.x + 20, y: corner.y + 60 }, { x: corner.x + 100, y: corner.y + 60 })

	// Konva assigns every node instance a unique internal id: equal ids
	// after an edit prove the nodes were reused, not rebuilt
	const nodeIds = () => page.evaluate(() => ({
		image: ((stage) => stage.findOne('Image')!)(window.Konva.stages[0]!)._id,
		annotations: window.Konva.stages[0]!.find('.annotation').map((node) => node._id),
	}))
	const before = await nodeIds()
	expect(before.annotations).toHaveLength(2)

	// An adjustment refilters the image but must not touch annotations
	await page.getByRole('button', { name: 'Adjust' }).click()
	await setInputValue(page.locator('[data-test="adjust-brightness"]'), '30')
	const afterAdjust = await nodeIds()
	expect(afterAdjust.annotations).toEqual(before.annotations)
	expect(afterAdjust.image).toBe(before.image)

	// Deleting one annotation must not rebuild its sibling
	await page.getByRole('button', { name: 'Select' }).click()
	await page.mouse.click(corner.x + 60, corner.y + 30)
	await page.keyboard.press('Delete')
	const afterDelete = await nodeIds()
	expect(afterDelete.annotations).toHaveLength(1)
	expect(before.annotations).toContain(afterDelete.annotations[0])
	expect(afterDelete.image).toBe(before.image)

	// Zooming the view changes no content at all: everything survives
	await page.locator('[data-test="zoom-in"]').click()
	const afterZoom = await nodeIds()
	expect(afterZoom.annotations).toEqual(afterDelete.annotations)
	expect(afterZoom.image).toBe(before.image)
})

test('undo reuses the nodes it did not change', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Annotate' }).click()
	await page.getByRole('button', { name: 'Draw' }).click()

	const corner = await imageTopLeft(page)
	await drag(page, { x: corner.x + 20, y: corner.y + 20 }, { x: corner.x + 90, y: corner.y + 20 })
	await drag(page, { x: corner.x + 20, y: corner.y + 45 }, { x: corner.x + 90, y: corner.y + 45 })

	const annotationIds = () => page.evaluate(() => window.Konva.stages[0]!.find('.annotation').map((node) => node._id))
	const before = await annotationIds()
	expect(before).toHaveLength(2)

	// A third stroke, then undo it away again
	await drag(page, { x: corner.x + 20, y: corner.y + 70 }, { x: corner.x + 90, y: corner.y + 70 })
	expect(await annotationIds()).toHaveLength(3)
	await page.locator('[aria-label="Undo"]').click()

	// The history holds the same annotation objects the scene was built
	// from, so the two survivors keep their nodes instead of every one
	// being rebuilt from a copy
	await expect.poll(annotationIds).toEqual(before)
})

test('saving an untouched image returns the original bytes', async ({ page }) => {
	await waitLoaded(page)
	const sourceSize = Number(await page.locator('[data-test="source-size"]').innerText())
	expect(sourceSize).toBeGreaterThan(0)

	const result = await save(page)

	// Re-encoding an unedited image costs a generation of quality and
	// throws away its metadata for no change at all
	expect(result.size).toBe(sourceSize)
	expect(result.mimeType).toBe('image/png')
})

test('saving an edited image re-encodes it', async ({ page }) => {
	await waitLoaded(page)
	const sourceSize = Number(await page.locator('[data-test="source-size"]').innerText())
	await page.getByRole('button', { name: 'Rotate right' }).click()

	const result = await save(page)
	expect(result.size).not.toBe(sourceSize)
	// The fixture is 200x100, so a quarter turn makes it 100x200
	expect(result.width).toBe(100)
	expect(result.height).toBe(200)
})
