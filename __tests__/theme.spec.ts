/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ambientBackdrop, primaryColor } from '../lib/utils/theme.ts'

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

	it('gives up rather than throwing on a tainted canvas', () => {
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
			drawImage: () => {},
		} as unknown as CanvasRenderingContext2D)
		vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(() => {
			throw new DOMException('Tainted canvases may not be exported', 'SecurityError')
		})
		const source = document.createElement('canvas')
		source.width = 100
		source.height = 50

		expect(ambientBackdrop(source)).toBe('')
	})
})
