/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { expect, test } from '@playwright/test'
import { readState, save, setInputValue, waitLoaded } from './utils.ts'

test('darkening brightness changes the exported pixels', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Adjust' }).click()
	await setInputValue(page.locator('[data-test="adjust-brightness"]'), '-50')

	expect((await readState(page)).adjustments.brightness).toBe(-50)

	const result = await save(page)
	// Brighten at -0.5 subtracts about 128 per channel: 200 red becomes ~72
	expect(result.topLeft[0]).toBeGreaterThan(40)
	expect(result.topLeft[0]).toBeLessThan(105)
	expect(result.topLeft[2]).toBeLessThan(20)
})

test('adjustment sliders record a single undo step on release', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Adjust' }).click()
	await page.locator('[data-test="tab-contrast"]').click()
	await setInputValue(page.locator('[data-test="adjust-contrast"]'), '40')

	await page.getByRole('button', { name: 'Undo' }).click()
	expect((await readState(page)).adjustments.contrast).toBe(0)
})

test('grayscale preset removes color', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Filter', exact: true }).click()
	await page.locator('[data-test="preset-grayscale"]').click()

	expect((await readState(page)).preset).toBe('grayscale')

	const result = await save(page)
	const [r, g, b] = result.topLeft
	expect(Math.abs(r - g)).toBeLessThanOrEqual(2)
	expect(Math.abs(g - b)).toBeLessThanOrEqual(2)
	expect(r).toBeGreaterThan(10)
})

test('invert preset flips the colors', async ({ page }) => {
	await waitLoaded(page)
	await page.getByRole('button', { name: 'Filter', exact: true }).click()
	await page.locator('[data-test="preset-invert"]').click()

	expect((await readState(page)).preset).toBe('invert')

	const result = await save(page)
	// rgb(200,0,0) inverts to rgb(55,255,255)
	expect(result.topLeft[1]).toBeGreaterThan(200)
	expect(result.topLeft[2]).toBeGreaterThan(200)
})
