/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { expect, test } from '@playwright/test'
import { cropAnchor, drag, imageTopLeft, readState, slowDrag, waitLoaded } from './utils.ts'

test('zooming keeps the crop rectangle being drawn', async ({ page }) => {
	await waitLoaded(page, 'large')

	// Pull the selection in from its corner, then change the view
	const anchor = await cropAnchor(page, 'top-left')
	await slowDrag(page, anchor, { x: anchor.x + 150, y: anchor.y + 100 })
	await page.locator('[data-test="zoom-in"]').click()
	await page.locator('[data-test="apply-crop"]').click()

	// The overlay used to be rebuilt from the committed state on every
	// render, so a zoom reset the selection to the whole image
	const { crop } = await readState(page)
	expect(crop).not.toBeNull()
	expect(crop.width).toBeLessThan(1800)
	expect(crop.height).toBeLessThan(1400)
})

test('resizing the container keeps the crop rectangle being drawn', async ({ page }) => {
	await waitLoaded(page, 'large')

	const anchor = await cropAnchor(page, 'top-left')
	await slowDrag(page, anchor, { x: anchor.x + 150, y: anchor.y + 100 })
	await page.setViewportSize({ width: 1000, height: 700 })
	await page.locator('[data-test="apply-crop"]').click()

	const { crop } = await readState(page)
	expect(crop).not.toBeNull()
	expect(crop.width).toBeLessThan(1800)
})

test('resetting the crop returns the overlay to the whole image', async ({ page }) => {
	await waitLoaded(page, 'large')

	const anchor = await cropAnchor(page, 'top-left')
	await slowDrag(page, anchor, { x: anchor.x + 150, y: anchor.y + 100 })
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
