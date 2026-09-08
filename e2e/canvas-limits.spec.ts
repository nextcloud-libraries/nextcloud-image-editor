/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'

/**
 * Make the browser behave like one with a small canvas cap: past the
 * area, the canvas paints nothing, which is what iOS actually does.
 *
 * @param page the test page
 * @param cap the largest area that still paints
 */
async function capCanvasAt(page: Page, cap: number): Promise<void> {
	await page.addInitScript((limit) => {
		const original = CanvasRenderingContext2D.prototype.getImageData
		CanvasRenderingContext2D.prototype.getImageData = function getImageData(...args: [number, number, number, number]) {
			// Past the cap a real browser hands back a canvas that never
			// painted, so every pixel reads back transparent
			if (this.canvas.width * this.canvas.height > limit) {
				return new ImageData(Math.max(1, args[2]), Math.max(1, args[3]))
			}
			return original.apply(this, args)
		} as typeof original
	}, cap)
}

test('a photo past the canvas cap asks before shrinking it', async ({ page }) => {
	await capCanvasAt(page, 640 * 640)
	await page.goto('/?src=large')

	const dialog = page.getByRole('dialog')
	await expect(dialog).toContainText('larger than this browser can edit')
	// The numbers are the point: what it is, and what it would become
	await expect(dialog).toContainText('megapixels')
	await expect(page.getByRole('button', { name: 'Continue with a smaller copy' })).toBeVisible()
	await expect(page.getByRole('button', { name: 'Close the editor' })).toBeVisible()
})

test('closing the warning leaves the editor instead of shrinking', async ({ page }) => {
	await capCanvasAt(page, 640 * 640)
	await page.goto('/?src=large')
	await page.getByRole('button', { name: 'Close the editor' }).click()

	// The library asks to be closed rather than closing itself, and it
	// never loads the image it was not allowed to shrink
	await expect(page.locator('[data-test="cancelled"]')).toHaveText('1')
	await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled()
})

test('continuing opens the image at a size the browser can hold', async ({ page }) => {
	await capCanvasAt(page, 640 * 640)
	await page.goto('/?src=large')
	await page.getByRole('button', { name: 'Continue with a smaller copy' }).click()

	await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled()
	await expect(page.locator('[data-test="cancelled"]')).toHaveText('0')
})

test('an image within the cap opens without asking anything', async ({ page }) => {
	await capCanvasAt(page, 4096 * 4096)
	await page.goto('/?src=test')

	await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled()
	await expect(page.getByRole('dialog')).toHaveCount(0)
})
