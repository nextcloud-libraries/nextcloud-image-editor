/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { describe, expect, it } from 'vitest'
import { berry, cinema, coast, cool, fade, golden, luna, mist, noir, warm } from '../lib/editor/filters.ts'

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

	it('golden warms highlights and dampens blue', () => {
		const image = pixels(100, 100, 100, 255)
		golden(image)
		expect(image.data[0]!).toBeGreaterThan(110)
		expect(image.data[1]!).toBeGreaterThan(100)
		expect(image.data[2]!).toBeLessThan(90)
	})

	it('coast adds contrast and tints only the shadows teal', () => {
		const dark = pixels(40, 40, 40, 255)
		coast(dark)
		expect(dark.data[2]!).toBeGreaterThan(dark.data[0]!)

		const bright = pixels(220, 220, 220, 255)
		coast(bright)
		// Above the shadow threshold the channels stay balanced
		expect(bright.data[2]!).toBe(bright.data[0]!)
		expect(bright.data[0]!).toBeGreaterThan(220)
	})

	it('mist lifts blacks and compresses whites', () => {
		const black = pixels(0, 0, 0, 255)
		mist(black)
		expect(black.data[0]!).toBeGreaterThan(15)

		const white = pixels(255, 255, 255, 255)
		mist(white)
		expect(white.data[0]!).toBeLessThan(245)
	})

	it('mist pulls saturated colors toward gray', () => {
		const image = pixels(200, 40, 40, 255)
		mist(image)
		const spread = image.data[0]! - image.data[1]!
		expect(spread).toBeLessThan(160 * 0.84)
	})

	it('berry casts magenta by dampening green', () => {
		const image = pixels(128, 128, 128, 255)
		berry(image)
		expect(image.data[0]!).toBeGreaterThan(128)
		expect(image.data[1]!).toBeLessThan(128)
		expect(image.data[2]!).toBeGreaterThan(128)
	})

	it('cinema pushes highlights orange and shadows teal', () => {
		const bright = pixels(220, 220, 220, 255)
		cinema(bright)
		expect(bright.data[0]!).toBeGreaterThan(bright.data[2]!)

		const dark = pixels(40, 40, 40, 255)
		cinema(dark)
		expect(dark.data[2]!).toBeGreaterThan(dark.data[0]!)
	})

	it('luna produces a soft monochrome with lifted shadows', () => {
		const image = pixels(120, 60, 30, 255)
		luna(image)
		expect(image.data[0]).toBe(image.data[1])
		expect(image.data[2]!).toBeGreaterThanOrEqual(image.data[0]!)

		const black = pixels(0, 0, 0, 255)
		luna(black)
		expect(black.data[0]!).toBeGreaterThan(10)
	})

	it('never touches the alpha channel', () => {
		for (const filter of [warm, cool, fade, noir, golden, coast, mist, berry, cinema, luna]) {
			const image = pixels(120, 130, 140, 200)
			filter(image)
			expect(image.data[3]).toBe(200)
		}
	})
})
