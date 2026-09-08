/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { describe, expect, it } from 'vitest'
import { berry, cinema, coast, cool, fade, golden, luna, mist, noir, saturate, sharpen, tonal, tone, vignette, warm } from '../lib/editor/filters.ts'

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
		saturate.call({ saturation: () => amount, getAttr: () => undefined }, image)
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

describe('tone', () => {
	/**
	 * Run the tone filter as Konva would, with the node carrying the
	 * amounts.
	 *
	 * @param attrs exposure, temperature and tint, each -1 to 1
	 * @param rgba the pixels to filter
	 */
	function filtered(attrs: Record<string, number>, ...rgba: number[]): number[] {
		const image = pixels(...rgba)
		tone.call({
			saturation: () => 0,
			getAttr: (name: string) => attrs[name],
		}, image)
		return [...image.data]
	}

	it('leaves the pixels alone with nothing set', () => {
		expect(filtered({}, 100, 120, 140, 255)).toEqual([100, 120, 140, 255])
	})

	it('doubles the light one stop up', () => {
		// The range spans two stops each way, so half of it is one stop
		expect(filtered({ exposure: 0.5 }, 50, 60, 70, 255)).toEqual([100, 120, 140, 255])
	})

	it('halves the light one stop down', () => {
		expect(filtered({ exposure: -0.5 }, 100, 120, 140, 255)).toEqual([50, 60, 70, 255])
	})

	it('is symmetrical about zero, as stops are', () => {
		// Equal travel each way cancels out, to within the rounding an
		// eight bit channel imposes on the way back
		const up = filtered({ exposure: 0.25 }, 100, 100, 100, 255)[0]!
		const down = filtered({ exposure: -0.25 }, 100, 100, 100, 255)[0]!
		expect((up / 100) * (down / 100)).toBeCloseTo(1, 2)
	})

	it('warms towards amber and cools towards blue', () => {
		const [warmR, , warmB] = filtered({ temperature: 1 }, 100, 100, 100, 255)
		expect(warmR!).toBeGreaterThan(100)
		expect(warmB!).toBeLessThan(100)

		const [coolR, , coolB] = filtered({ temperature: -1 }, 100, 100, 100, 255)
		expect(coolR!).toBeLessThan(100)
		expect(coolB!).toBeGreaterThan(100)
	})

	it('moves green against the other two channels for tint', () => {
		const [magentaR, magentaG, magentaB] = filtered({ tint: 1 }, 100, 100, 100, 255)
		expect(magentaG!).toBeLessThan(100)
		expect(magentaR!).toBeGreaterThan(100)
		expect(magentaB!).toBeGreaterThan(100)

		const [, greenG] = filtered({ tint: -1 }, 100, 100, 100, 255)
		expect(greenG!).toBeGreaterThan(100)
	})

	it('leaves the alpha channel untouched', () => {
		expect(filtered({ exposure: 1, temperature: 1, tint: 1 }, 10, 20, 30, 123)[3]).toBe(123)
	})
})

describe('sharpen', () => {
	/**
	 * A greyscale image from a grid of luminances.
	 *
	 * @param rows the pixel values, one array per row
	 */
	function image(rows: number[][]) {
		const height = rows.length
		const width = rows[0]!.length
		const data = new Uint8ClampedArray(width * height * 4)
		rows.forEach((row, y) => row.forEach((value, x) => {
			const i = (y * width + x) * 4
			data[i] = data[i + 1] = data[i + 2] = value
			data[i + 3] = 255
		}))
		return { data, width, height }
	}

	/**
	 * @param amount the sharpen amount, -1 to 1
	 * @param rows the pixel grid
	 */
	function filtered(amount: number, rows: number[][]) {
		const target = image(rows)
		sharpen.call({ saturation: () => 0, getAttr: () => amount }, target)
		// Report the centre pixel's red channel: the interesting one
		const centre = (Math.floor(rows.length / 2) * rows[0]!.length + Math.floor(rows[0]!.length / 2)) * 4
		return target.data[centre]!
	}

	/** A single bright pixel surrounded by dark ones */
	const EDGE = [
		[10, 10, 10],
		[10, 100, 10],
		[10, 10, 10],
	]

	it('does nothing at zero', () => {
		expect(filtered(0, EDGE)).toBe(100)
	})

	it('drives an edge further from its surroundings', () => {
		expect(filtered(0.5, EDGE)).toBeGreaterThan(100)
	})

	it('leaves a flat area flat', () => {
		const flat = [
			[80, 80, 80],
			[80, 80, 80],
			[80, 80, 80],
		]
		expect(filtered(1, flat)).toBe(80)
	})

	it('softens instead when the amount is negative', () => {
		expect(filtered(-0.5, EDGE)).toBeLessThan(100)
	})

	it('leaves the border alone rather than inventing neighbours', () => {
		const target = image(EDGE)
		sharpen.call({ saturation: () => 0, getAttr: () => 1 }, target)
		// Top-left corner has no full neighbourhood
		expect(target.data[0]).toBe(10)
	})
})

describe('tonal', () => {
	/**
	 * Run the highlights and shadows filter as Konva would.
	 *
	 * @param attrs highlights and shadows, each -1 to 1
	 * @param rgba the pixels to filter
	 */
	function filtered(attrs: Record<string, number>, ...rgba: number[]): number[] {
		const image = pixels(...rgba)
		tonal.call({
			saturation: () => 0,
			getAttr: (name: string) => attrs[name],
		}, image)
		return [...image.data]
	}

	it('pulls the bright end down and leaves the dark end where it was', () => {
		const dark = filtered({ highlights: -1 }, 20, 20, 20, 255)
		const bright = filtered({ highlights: -1 }, 230, 230, 230, 255)
		expect(bright[0]).toBeLessThan(230)
		// A quarter of the way down at most, the dark end barely moves
		expect(dark[0]).toBeGreaterThan(18)
	})

	it('lifts the dark end and leaves the bright end where it was', () => {
		const dark = filtered({ shadows: 1 }, 20, 20, 20, 255)
		const bright = filtered({ shadows: 1 }, 230, 230, 230, 255)
		expect(dark[0]).toBeGreaterThan(20)
		expect(bright[0]).toBeGreaterThan(228)
		expect(bright[0]).toBeLessThanOrEqual(235)
	})

	it('leaves the midtones to the other sliders', () => {
		const [red] = filtered({ highlights: -1, shadows: 1 }, 128, 128, 128, 255)
		// Both ends pull on a midtone, and they pull about equally
		expect(Math.abs(red! - 128)).toBeLessThan(12)
	})

	it('does nothing at zero', () => {
		expect(filtered({ highlights: 0, shadows: 0 }, 40, 90, 200, 255)).toEqual([40, 90, 200, 255])
	})

	it('keeps a neutral pixel neutral', () => {
		const [red, green, blue] = filtered({ shadows: 1 }, 60, 60, 60, 255)
		expect(red).toBe(green)
		expect(green).toBe(blue)
	})
})

describe('vignette', () => {
	/**
	 * A flat mid-gray image of the given size, filtered.
	 *
	 * @param amount the vignette attribute, -1 to 1
	 * @param width the image width
	 * @param height the image height
	 */
	function filtered(amount: number, width: number, height: number) {
		const data = new Uint8ClampedArray(width * height * 4).fill(128)
		const image = { data, width, height }
		vignette.call({
			saturation: () => 0,
			getAttr: (name: string) => (name === 'vignette' ? amount : 0),
		}, image)
		const at = (x: number, y: number) => data[(y * width + x) * 4]!
		return { at, centre: at(width >> 1, height >> 1) }
	}

	it('darkens the corners and leaves the centre alone', () => {
		const { at, centre } = filtered(1, 21, 21)
		expect(centre).toBe(128)
		expect(at(0, 0)).toBeLessThan(centre)
		expect(at(20, 20)).toBeLessThan(centre)
	})

	it('darkens further the further out it goes', () => {
		const { at } = filtered(1, 21, 21)
		expect(at(10, 2)).toBeLessThan(at(10, 8))
	})

	it('lightens the corners below zero', () => {
		const { at, centre } = filtered(-1, 21, 21)
		expect(at(0, 0)).toBeGreaterThan(centre)
	})

	it('follows the frame rather than cropping to a circle', () => {
		// On a wide image the short edge is as far out as the long one
		const { at } = filtered(1, 41, 11)
		expect(at(20, 0)).toBeLessThan(128)
		expect(at(0, 5)).toBeLessThan(128)
	})

	it('does nothing at zero', () => {
		const { at, centre } = filtered(0, 9, 9)
		expect(at(0, 0)).toBe(centre)
	})
})
