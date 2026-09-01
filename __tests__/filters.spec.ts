/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { describe, expect, it } from 'vitest'
import { cool, fade, noir, warm } from '../lib/editor/filters.ts'

function pixels(...rgba: number[]): { data: Uint8ClampedArray } {
	return { data: new Uint8ClampedArray(rgba) }
}

describe('pixel filters', () => {
	it('warm lifts red and dampens blue', () => {
		const image = pixels(100, 100, 100, 255)
		warm(image)
		expect(image.data[0]).toBeGreaterThan(100)
		expect(image.data[1]).toBe(100)
		expect(image.data[2]).toBeLessThan(100)
	})

	it('cool lifts blue and dampens red', () => {
		const image = pixels(100, 100, 100, 255)
		cool(image)
		expect(image.data[0]).toBeLessThan(100)
		expect(image.data[2]).toBeGreaterThan(100)
	})

	it('warm and cool clamp at white', () => {
		const image = pixels(250, 250, 250, 255)
		warm(image)
		expect(image.data[0]).toBe(255)
	})

	it('fade lifts pure black', () => {
		const image = pixels(0, 0, 0, 255)
		fade(image)
		expect(image.data[0]).toBeGreaterThan(20)
		expect(image.data[1]).toBeGreaterThan(20)
		expect(image.data[2]).toBeGreaterThan(20)
	})

	it('noir produces equal channels with added contrast', () => {
		const bright = pixels(180, 180, 180, 255)
		noir(bright)
		expect(bright.data[0]).toBe(bright.data[1])
		expect(bright.data[1]).toBe(bright.data[2])
		expect(bright.data[0]!).toBeGreaterThan(180)

		const dark = pixels(60, 60, 60, 255)
		noir(dark)
		expect(dark.data[0]!).toBeLessThan(60)
	})

	it('never touches the alpha channel', () => {
		for (const filter of [warm, cool, fade, noir]) {
			const image = pixels(120, 130, 140, 200)
			filter(image)
			expect(image.data[3]).toBe(200)
		}
	})
})
