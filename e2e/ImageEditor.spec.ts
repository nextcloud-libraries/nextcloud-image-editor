/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { expect, test } from '@playwright/test'
import { expectColor, save, waitLoaded } from './utils.ts'

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
		return stage.findOne('Group').scaleX()
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
