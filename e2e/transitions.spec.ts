/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { waitLoaded } from './utils.ts'

// The transitions are skipped for users who ask for reduced motion, so
// the preference has to be pinned for these to mean anything
test.use({ reducedMotion: 'no-preference' })

interface Peak {
	/** Largest angle the layer reached, in degrees */
	rotation: number
	/** Largest departure from unit scale the layer reached */
	scale: number
	/** Whether it came back to rest */
	settled: boolean
}

/**
 * Press a toolbar button and watch the named Konva layers for the
 * length of the transition it starts.
 *
 * The press happens inside the page so no round trip can land between
 * the transition starting and the sampling starting.
 *
 * @param page the test page
 * @param label the accessible name of the button to press
 * @param layers the Konva layer names to watch
 */
async function peaksAfterPress(page: Page, label: string, layers: string[]): Promise<Record<string, Peak>> {
	return page.evaluate(({ label: buttonLabel, layers: names }) => new Promise<Record<string, Peak>>((resolve, reject) => {
		const button = document.querySelector<HTMLButtonElement>(`button[aria-label="${buttonLabel}"]`)
		if (button === null) {
			reject(new Error(`No button labelled ${buttonLabel}`))
			return
		}
		const peaks: Record<string, Peak> = {}
		for (const name of names) {
			peaks[name] = { rotation: 0, scale: 0, settled: false }
		}
		button.click()

		const started = performance.now()
		const tick = () => {
			for (const name of names) {
				// Re-found every frame: a rotation rebuilds the overlay
				const layer = window.Konva.stages[0]!.findOne(`.${name}`)
				if (layer === undefined) {
					continue
				}
				const peak = peaks[name]!
				peak.rotation = Math.max(peak.rotation, Math.abs(layer.rotation()))
				peak.scale = Math.max(peak.scale, Math.abs(layer.scaleX() - 1))
				peak.settled = Math.abs(layer.rotation()) < 0.01 && Math.abs(layer.scaleX() - 1) < 0.01
			}
			if (performance.now() - started < 800) {
				requestAnimationFrame(tick)
				return
			}
			resolve(peaks)
		}
		requestAnimationFrame(tick)
	}), { label, layers })
}

test('the crop overlay turns with the image', async ({ page }) => {
	await waitLoaded(page, 'large')
	const peaks = await peaksAfterPress(page, 'Rotate right', ['content', 'crop'])

	// The content group eases from the inverse of the turn to identity
	expect(peaks.content!.rotation).toBeGreaterThan(1)
	// The overlay has to do the same, or its handles snap into place
	// while the image is still turning
	expect(peaks.crop!.rotation).toBeGreaterThan(1)
	expect(peaks.crop!.settled).toBe(true)
})

test('the crop overlay mirrors with the image', async ({ page }) => {
	await waitLoaded(page, 'large')
	const peaks = await peaksAfterPress(page, 'Flip horizontal', ['content', 'crop'])

	expect(peaks.content!.scale).toBeGreaterThan(0.1)
	expect(peaks.crop!.scale).toBeGreaterThan(0.1)
	expect(peaks.crop!.settled).toBe(true)
})

test('the overlay ends where the committed state puts it', async ({ page }) => {
	await waitLoaded(page, 'large')
	await page.getByRole('button', { name: 'Rotate right' }).click()

	// After the tween the overlay is back to identity, so the rectangle
	// it reports is the committed one and not a midpoint of the tween
	await expect.poll(async () => page.evaluate(() => {
		const layer = window.Konva.stages[0]!.findOne('.crop')
		return layer === undefined ? null : Math.abs(layer.rotation()) + Math.abs(layer.scaleX() - 1)
	})).toBeLessThan(0.01)
})
