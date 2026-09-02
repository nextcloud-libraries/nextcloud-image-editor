/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ambientBackdrop, ambientColor, primaryColor } from '../lib/utils/theme.ts'

/**
 * Fill an 8x8 sample with the given pixels, repeated to length.
 *
 * @param pixels the rgba values to repeat
 */
function sampleOf(...pixels: number[]): Uint8ClampedArray {
	const data = new Uint8ClampedArray(8 * 8 * 4)
	for (let i = 0; i < data.length; i += 4) {
		for (let channel = 0; channel < 4; channel++) {
			data[i + channel] = pixels[(i + channel) % pixels.length]!
		}
	}
	return data
}

/**
 * Stub the 2D context so sampling reports the given pixels.
 *
 * @param data the pixels getImageData returns
 * @param dataUrl what toDataURL reports
 */
function stubCanvas(data: Uint8ClampedArray | null, dataUrl = 'data:image/png;base64,STUB') {
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(data === null
		? null
		: ({
				drawImage: () => {},
				getImageData: () => ({ data }),
			} as unknown as CanvasRenderingContext2D))
	vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(dataUrl)
}

describe('primaryColor', () => {
	afterEach(() => vi.restoreAllMocks())

	it('reads the theme colour', () => {
		vi.spyOn(window, 'getComputedStyle').mockReturnValue({
			getPropertyValue: () => ' #123456 ',
		} as unknown as CSSStyleDeclaration)
		expect(primaryColor()).toBe('#123456')
	})

	it('falls back to the Nextcloud blue where no theme defines one', () => {
		vi.spyOn(window, 'getComputedStyle').mockReturnValue({
			getPropertyValue: () => '',
		} as unknown as CSSStyleDeclaration)
		expect(primaryColor()).toBe('#0082c9')
	})
})

describe('ambientColor', () => {
	afterEach(() => vi.restoreAllMocks())

	it('averages a flat image to its own colour', () => {
		stubCanvas(sampleOf(120, 60, 30, 255))
		expect(ambientColor(document.createElement('canvas'))).toBe('120, 60, 30')
	})

	it('leans towards the colourful pixels rather than the grey ones', () => {
		// Half mid-grey, half saturated red: a flat average would land
		// near 190,128,128, the weighting pulls it towards the red
		const data = sampleOf(128, 128, 128, 255, 255, 0, 0, 255)
		stubCanvas(data)
		const [red, green] = ambientColor(document.createElement('canvas')).split(', ').map(Number)

		expect(red!).toBeGreaterThan(190)
		expect(green!).toBeLessThan(110)
	})

	it('falls back to a neutral tint without a context', () => {
		stubCanvas(null)
		expect(ambientColor(document.createElement('canvas'))).toBe('88, 86, 112')
	})
})

describe('ambientBackdrop', () => {
	afterEach(() => vi.restoreAllMocks())

	it('renders a tiny copy keeping the aspect ratio', () => {
		stubCanvas(sampleOf(10, 20, 30, 255))
		const source = document.createElement('canvas')
		source.width = 800
		source.height = 400

		expect(ambientBackdrop(source)).toBe('data:image/png;base64,STUB')
	})

	it('gives up on an image with no intrinsic size', () => {
		stubCanvas(sampleOf(10, 20, 30, 255))
		// An SVG without width and height decodes to nothing measurable
		const source = { naturalWidth: 0, naturalHeight: 0 } as HTMLImageElement
		Object.setPrototypeOf(source, HTMLImageElement.prototype)

		expect(ambientBackdrop(source)).toBe('')
	})

	it('gives up without a context', () => {
		stubCanvas(null)
		const source = document.createElement('canvas')
		source.width = 100
		source.height = 50

		expect(ambientBackdrop(source)).toBe('')
	})
})
