/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { cropAnchor, cropStageRect, drag, imageTopLeft, imageView, readState, slowDrag, waitLoaded } from './utils.ts'

/**
 * The crop rectangle in image coordinates, which is what has to
 * survive a view change. The overlay draws in stage pixels, so the
 * view scale divides back out.
 *
 * @param page the test page
 */
async function cropSceneWidth(page: Page): Promise<number> {
	const rect = (await cropStageRect(page))!
	return rect.width / (await imageView(page)).scale
}

/**
 * Pull the crop rectangle in from its top left corner and confirm the
 * gesture landed on the anchor, so a missed drag fails here instead of
 * quietly leaving the whole image selected.
 *
 * @param page the test page
 */
async function shrinkCrop(page: Page) {
	const before = (await cropStageRect(page))!
	const anchor = await cropAnchor(page, 'top-left')
	await slowDrag(page, anchor, { x: anchor.x + 150, y: anchor.y + 100 })

	const after = (await cropStageRect(page))!
	expect(after.width, 'the anchor drag did not resize the crop').toBeLessThan(before.width - 100)
	return after
}

test('zooming keeps the crop rectangle being drawn', async ({ page }) => {
	await waitLoaded(page, 'large')

	// Pull the selection in from its corner, then change the view
	await shrinkCrop(page)
	const before = await cropSceneWidth(page)
	await page.locator('[data-test="zoom-in"]').click()

	// The overlay used to be rebuilt from the committed state on every
	// render, so a zoom reset the selection to the whole image
	expect(Math.abs(await cropSceneWidth(page) - before)).toBeLessThan(3)

	await page.locator('[data-test="apply-crop"]').click()
	const { crop } = await readState(page)
	expect(crop).not.toBeNull()
	expect(crop.width).toBeCloseTo(before, -1)
})

test('resizing the container keeps the crop rectangle being drawn', async ({ page }) => {
	await waitLoaded(page, 'large')

	await shrinkCrop(page)
	const before = await cropSceneWidth(page)
	await page.setViewportSize({ width: 1000, height: 700 })

	// The container is measured again and the overlay re-projected, on
	// the same image coordinates
	await expect.poll(async () => Math.abs(await cropSceneWidth(page) - before)).toBeLessThan(3)

	await page.locator('[data-test="apply-crop"]').click()
	const { crop } = await readState(page)
	expect(crop.width).toBeCloseTo(before, -1)
})

test('resetting the crop returns the overlay to the whole image', async ({ page }) => {
	await waitLoaded(page, 'large')

	await shrinkCrop(page)
	await page.locator('[data-test="apply-crop"]').click()
	expect((await readState(page)).crop).not.toBeNull()

	// Back to crop, drop the crop: the overlay has to follow the state
	await page.getByRole('button', { name: 'Crop', exact: true }).click()
	await page.locator('[data-test="reset-crop"]').click()
	await page.locator('[data-test="apply-crop"]').click()

	const { crop } = await readState(page)
	expect(crop.width).toBe(2000)
	expect(crop.height).toBe(1500)
})

test('the selection survives dragging an annotation', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Annotate' }).click()
	await page.getByRole('button', { name: 'Rectangle' }).click()

	const corner = await imageTopLeft(page)
	await drag(page, { x: corner.x + 20, y: corner.y + 20 }, { x: corner.x + 80, y: corner.y + 60 })

	await page.getByRole('button', { name: 'Select' }).click()
	await page.mouse.click(corner.x + 50, corner.y + 20)
	await expect(page.locator('[data-test="selection-toolbar"]')).toBeVisible()

	// Committing the drag rebuilds the node; the transformer has to
	// re-find it instead of the whole selection being torn down
	await slowDrag(page, { x: corner.x + 50, y: corner.y + 40 }, { x: corner.x + 70, y: corner.y + 50 })
	await expect(page.locator('[data-test="selection-toolbar"]')).toBeVisible()
	expect((await readState(page)).annotations).toHaveLength(1)
})
