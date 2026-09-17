/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { expect, test } from '@playwright/test'
import { drag, expectColor, imageTopLeft, readState, save, setInputValue, undo, waitLoaded } from './utils.ts'

test('renders the canvas stage and chrome', async ({ page }) => {
	await waitLoaded(page)
	await expect(page.getByRole('button', { name: 'Close the editor' })).toBeEnabled()
	for (const mode of ['Crop', 'Adjust', 'Filter', 'Annotate', 'Sticker']) {
		await expect(page.getByRole('button', { name: mode, exact: true })).toBeEnabled()
	}
	await expect(page.locator('[role="img"] canvas').first()).toBeVisible()
})

test('closing an untouched image asks nothing', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Close the editor' }).click()
	await expect(page.locator('[data-test="cancelled"]')).toHaveText('1')
	await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('closing an edited image offers to save it', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Rotate right' }).click()
	await expect.poll(async () => (await readState(page)).rotation).toBe(90)

	// Dismissing the dialog is the third answer: stay in the editor
	await page.getByRole('button', { name: 'Close the editor' }).click()
	const dialog = page.getByRole('dialog')
	await dialog.getByRole('button', { name: 'Cancel' }).click()
	await expect(page.locator('[data-test="cancelled"]')).toHaveText('0')
	await expect(page.locator('[data-test="saved"]')).toHaveText('')

	// Saving from the dialog is the save button
	await page.getByRole('button', { name: 'Close the editor' }).click()
	await dialog.getByRole('button', { name: 'Save' }).click()
	await expect(page.locator('[data-test="saved"]')).not.toHaveText('')
	await expect(page.locator('[data-test="cancelled"]')).toHaveText('0')
})

test('discarding from the close dialog leaves the editor', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Rotate right' }).click()
	await expect.poll(async () => (await readState(page)).rotation).toBe(90)

	await page.getByRole('button', { name: 'Close the editor' }).click()
	await page.getByRole('dialog').getByRole('button', { name: 'Discard changes' }).click()
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
	// Zooming out starts available: the view goes below the fitted one
	await expect(page.locator('[data-test="zoom-out"]')).toBeEnabled()

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

	for (const mode of ['Crop', 'Adjust', 'Filter', 'Annotate', 'Sticker', 'Blur']) {
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
	// Only the floor disables zooming out, and the fitted view is not it
	await expect(page.locator('[data-test="zoom-in"]')).toBeEnabled()
	await expect(page.locator('[data-test="zoom-out"]')).toBeEnabled()
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
	await page.locator('[data-test="tab-brightness"]').click()
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
	await undo(page)

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

test('an edited photo is written at the quality it arrived at', async ({ page }) => {
	// The fixture is encoded at 0.8, which is neither browser's own
	// default: left to itself Chromium would write 92 here and Firefox
	// the same number with fuller chroma
	await waitLoaded(page, 'quality')
	await page.getByRole('button', { name: 'Rotate right' }).click()

	const result = await save(page)
	expect(result.mimeType).toBe('image/jpeg')
	expect(result.quality).toBe(80)
})

test('renders a state stored before the newer adjustments existed', async ({ page }) => {
	// The playground seeds only brightness, contrast and saturation, the
	// way a host that stored a state and then upgraded would. A missing
	// adjustment is not zero: it reads as work to do, is divided into
	// NaN, and paints the whole image black.
	await page.goto('/?src=test&restore=1')
	await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled()

	const result = await save(page)
	// The fixture is red over blue, rotated a quarter turn by the state
	expect(result.topLeft[0] + result.topLeft[1] + result.topLeft[2]).toBeGreaterThan(60)
})

test('opens on a state the host hands over', async ({ page }) => {
	await page.goto('/?src=test&restore=1')
	await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled()

	// The stored edit is in place before the user has touched anything
	const state = await readState(page)
	expect(state.rotation).toBe(90)
	expect(state.adjustments.brightness).toBe(15)
	expect(state.annotations).toHaveLength(1)

	// A resumed session starts from the state it was handed, not from
	// the untouched image
	// Revert lives in the history menu, which stays shut with nothing to undo
	await expect(page.locator('[data-test="history"] button')).toBeDisabled()
	const result = await save(page)
	expect(result.width).toBe(100)
	expect(result.height).toBe(200)
})

test('the save button reports progress until the host is done', async ({ page }) => {
	await waitLoaded(page)
	const spinner = page.locator('[data-test="saving"]')
	const button = page.getByRole('button', { name: 'Save' })
	await expect(spinner).toBeHidden()

	await button.click()

	// The playground holds saving high for a moment after taking the
	// blob, as a host storing it would: the editor cannot know when the
	// upload finished unless it is told
	await expect(spinner).toBeVisible()
	await expect(button).toBeDisabled()

	// And lets go again once the host does
	await expect(spinner).toBeHidden({ timeout: 5000 })
	await expect(button).toBeEnabled()
})

test('the loading spinner turns', async ({ page }) => {
	// Hold the photo back so the spinner stays on screen: the save
	// spinner is gone in 400ms, which is a race on a slow machine. The
	// demo page hands the editor a URL, so the wait is the editor's own
	await page.route('**/*.jpg', async (route) => {
		await new Promise((resolve) => setTimeout(resolve, 3000))
		await route.continue()
	})
	await page.goto('/', { waitUntil: 'domcontentloaded' })

	// NcLoadingIcon animates on a `rotate` keyframe that the server
	// stylesheet owns and @nextcloud/vue does not ship, so the icon was
	// drawn and then held still. An animation naming a keyframe nobody
	// defined still reports that name, so the name is not the test: the
	// keyframe has to be there, and the icon has to move.
	const svg = page.locator('.image-editor__loading svg')
	await expect(svg).toBeVisible()
	const animation = await svg.evaluate((element) => {
		const name = getComputedStyle(element).animationName
		const defined = [...document.styleSheets].some((sheet) => (
			[...sheet.cssRules].some((rule) => rule instanceof CSSKeyframesRule && rule.name === name)
		))
		return { name, defined }
	})
	expect(animation.name).not.toBe('none')
	expect(animation.defined).toBe(true)

	const first = await svg.evaluate((element) => getComputedStyle(element).transform)
	await expect
		.poll(async () => svg.evaluate((element) => getComputedStyle(element).transform))
		.not.toBe(first)
})
