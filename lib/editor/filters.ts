/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/** The subset of ImageData the pixel filters operate on */
export interface PixelData {
	data: Uint8ClampedArray
}

/** Konva calls a filter with the node it belongs to as `this` */
export interface FilterNode {
	/** Amount between -1 and 1, 0 meaning unchanged */
	saturation(): number
}

/**
 * Rec. 601 luma, the gray a pixel collapses to.
 *
 * @param r the red channel
 * @param g the green channel
 * @param b the blue channel
 */
function luma(r: number, g: number, b: number): number {
	return 0.299 * r + 0.587 * g + 0.114 * b
}

/**
 * Linear saturation: each channel moves away from the pixel's luma by
 * the given factor. Konva's own HSL filter raises 2 to the amount, so
 * it can lighten or deepen colors but never reaches gray, which left
 * the saturation slider unable to do the one thing its lower half
 * promises.
 *
 * @param imageData the pixels to mutate in place
 */
export function saturate(this: FilterNode, imageData: PixelData): void {
	const { data } = imageData
	// -1 collapses to gray, 0 is unchanged, 1 doubles the distance
	const factor = this.saturation() + 1
	for (let i = 0; i < data.length; i += 4) {
		const gray = luma(data[i]!, data[i + 1]!, data[i + 2]!)
		data[i] = gray + (data[i]! - gray) * factor
		data[i + 1] = gray + (data[i + 1]! - gray) * factor
		data[i + 2] = gray + (data[i + 2]! - gray) * factor
	}
}

/**
 * Warm tint: lifts red, dampens blue.
 *
 * @param imageData the pixels to mutate in place
 */
export function warm(imageData: PixelData): void {
	const { data } = imageData
	for (let i = 0; i < data.length; i += 4) {
		data[i] = Math.min(255, data[i]! * 1.12)
		data[i + 2] = data[i + 2]! * 0.9
	}
}

/**
 * Cool tint: lifts blue, dampens red.
 *
 * @param imageData the pixels to mutate in place
 */
export function cool(imageData: PixelData): void {
	const { data } = imageData
	for (let i = 0; i < data.length; i += 4) {
		data[i] = data[i]! * 0.9
		data[i + 2] = Math.min(255, data[i + 2]! * 1.12)
	}
}

/**
 * Faded film look: lifted blacks, mild desaturation, a touch of warmth.
 *
 * @param imageData the pixels to mutate in place
 */
export function fade(imageData: PixelData): void {
	const { data } = imageData
	for (let i = 0; i < data.length; i += 4) {
		const luma = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!
		// 70% original + 30% luma, compressed into a lifted range
		data[i] = 28 + (0.7 * data[i]! + 0.3 * luma) * 0.86 * 1.04
		data[i + 1] = 28 + (0.7 * data[i + 1]! + 0.3 * luma) * 0.86
		data[i + 2] = 28 + (0.7 * data[i + 2]! + 0.3 * luma) * 0.86 * 0.96
	}
}

/**
 * High-contrast black and white.
 *
 * @param imageData the pixels to mutate in place
 */
export function noir(imageData: PixelData): void {
	const { data } = imageData
	for (let i = 0; i < data.length; i += 4) {
		const luma = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!
		// Steepened S-curve around the midpoint
		const value = Math.min(255, Math.max(0, (luma - 128) * 1.35 + 118))
		data[i] = value
		data[i + 1] = value
		data[i + 2] = value
	}
}

/**
 * Golden hour: warm amber highlights and gently dampened blues.
 *
 * @param imageData the pixels to mutate in place
 */
export function golden(imageData: PixelData): void {
	const { data } = imageData
	for (let i = 0; i < data.length; i += 4) {
		data[i] = data[i]! * 1.12 + 12
		data[i + 1] = data[i + 1]! * 1.04 + 5
		data[i + 2] = data[i + 2]! * 0.82
	}
}

/**
 * Bright coastal look: punchy contrast with teal-tinted shadows.
 *
 * @param imageData the pixels to mutate in place
 */
export function coast(imageData: PixelData): void {
	const { data } = imageData
	for (let i = 0; i < data.length; i += 4) {
		const luma = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!
		// The teal cast only reaches into the shadows
		const shadow = Math.max(0, 1 - luma / 140)
		data[i] = (data[i]! - 128) * 1.12 + 132
		data[i + 1] = (data[i + 1]! - 128) * 1.12 + 132 + 10 * shadow
		data[i + 2] = (data[i + 2]! - 128) * 1.12 + 132 + 22 * shadow
	}
}

/**
 * Soft matte look: desaturated, lifted blacks, compressed highlights.
 *
 * @param imageData the pixels to mutate in place
 */
export function mist(imageData: PixelData): void {
	const { data } = imageData
	for (let i = 0; i < data.length; i += 4) {
		const luma = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!
		// 60% original + 40% luma, squeezed into a matte range
		data[i] = 22 + (0.6 * data[i]! + 0.4 * luma) * 0.84
		data[i + 1] = 22 + (0.6 * data[i + 1]! + 0.4 * luma) * 0.84
		data[i + 2] = 26 + (0.6 * data[i + 2]! + 0.4 * luma) * 0.84
	}
}

/**
 * Moody plum tint: magenta cast with deepened shadows.
 *
 * @param imageData the pixels to mutate in place
 */
export function berry(imageData: PixelData): void {
	const { data } = imageData
	for (let i = 0; i < data.length; i += 4) {
		data[i] = (data[i]! - 128) * 1.08 + 128 + 10
		data[i + 1] = (data[i + 1]! - 128) * 1.08 + 128 - 12
		data[i + 2] = (data[i + 2]! - 128) * 1.08 + 128 + 8
	}
}

/**
 * Film grade: orange-leaning highlights against teal shadows.
 *
 * @param imageData the pixels to mutate in place
 */
export function cinema(imageData: PixelData): void {
	const { data } = imageData
	for (let i = 0; i < data.length; i += 4) {
		const luma = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!
		// -1 in the deepest shadows, +1 in the brightest highlights
		const balance = (luma - 128) / 128
		data[i] = (data[i]! - 128) * 1.06 + 128 + 16 * balance
		data[i + 1] = (data[i + 1]! - 128) * 1.06 + 128
		data[i + 2] = (data[i + 2]! - 128) * 1.06 + 128 - 20 * balance
	}
}

/**
 * Silvery monochrome: soft black and white with lifted shadows.
 *
 * @param imageData the pixels to mutate in place
 */
export function luna(imageData: PixelData): void {
	const { data } = imageData
	for (let i = 0; i < data.length; i += 4) {
		const luma = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!
		// Gentle roll-off instead of noir's hard S-curve
		const value = 18 + luma * 0.9
		data[i] = value
		data[i + 1] = value
		data[i + 2] = value + 4
	}
}
