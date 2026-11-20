/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('edits a local file and hands the edited Blob back', async ({ page }) => {
	await page.goto('/?demo=local-file')
	await page.getByLabel('Pick an image to edit').setInputFiles({
		name: 'holiday.jpg',
		mimeType: 'image/jpeg',
		buffer: await readFile(new URL('../playground/with-metadata.jpg', import.meta.url)),
	})

	await page.getByRole('button', { name: 'Rotate right' }).click()
	await page.getByRole('button', { name: 'Save', exact: true }).click()

	const result = page.locator('[data-test="local-result"]')
	await expect(result).toContainText('image/jpeg')
	const download = result.getByRole('link')
	await expect(download).toHaveAttribute('download', 'holiday-edited.jpg')

	// The link points at the edited Blob itself
	const blob = await download.evaluate(async (link: HTMLAnchorElement) => {
		const saved = await (await fetch(link.href)).blob()
		return { type: saved.type, size: saved.size }
	})
	expect(blob.type).toBe('image/jpeg')
	expect(blob.size).toBeGreaterThan(0)
	await expect(page.getByRole('alert')).toHaveCount(0)
})
