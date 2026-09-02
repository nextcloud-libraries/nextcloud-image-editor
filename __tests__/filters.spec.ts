/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { describe, expect, it } from 'vitest'
import { berry, cinema, coast, cool, fade, golden, luna, mist, noir, saturate, warm } from '../lib/editor/filters.ts'

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

describe('saturate', () => {
	/**
	 * Run the filter as Konva would, with the node providing the amount.
	 *
	 * @param amount saturation between -1 and 1
	 * @param rgba the pixels to filter
	 */
	function filtered(amount: number, ...rgba: number[]): number[] {
		const image = pixels(...rgba)
		saturate.call({ saturation: () => amount }, image)
		return [...image.data]
	}

	it('collapses to gray at the bottom of the range', () => {
		// Rec. 601 luma of pure red is 0.299 * 200
		const [r, g, b] = filtered(-1, 200, 0, 0, 255)
		expect(r).toBe(g)
		expect(g).toBe(b)
		expect(r).toBeCloseTo(60, 0)
	})

	it('leaves the pixels alone at zero', () => {
		expect(filtered(0, 200, 40, 10, 255)).toEqual([200, 40, 10, 255])
	})

	it('pushes the channels apart at the top of the range', () => {
		// A pixel with room to move on both sides of its luma
		const [r, g, b] = filtered(1, 150, 120, 100, 255)
		const gray = 0.299 * 150 + 0.587 * 120 + 0.114 * 100
		expect(r).toBeCloseTo(gray + (150 - gray) * 2, 0)
		expect(g).toBeCloseTo(gray + (120 - gray) * 2, 0)
		expect(b).toBeCloseTo(gray + (100 - gray) * 2, 0)
	})

	it('clamps rather than wrapping where a channel runs out of range', () => {
		// Doubling pure red's distance from gray overshoots both ends
		const [r, g, b] = filtered(1, 200, 40, 10, 255)
		expect(r).toBe(255)
		expect(g).toBe(0)
		expect(b).toBe(0)
	})

	it('keeps a gray pixel gray at every amount', () => {
		for (const amount of [-1, -0.5, 0, 0.5, 1]) {
			expect(filtered(amount, 128, 128, 128, 255).slice(0, 3)).toEqual([128, 128, 128])
		}
	})

	it('leaves the alpha channel untouched', () => {
		expect(filtered(-1, 10, 20, 30, 123)[3]).toBe(123)
	})
})
