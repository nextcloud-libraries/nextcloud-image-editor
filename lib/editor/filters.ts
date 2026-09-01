/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/** The subset of ImageData the pixel filters operate on */
export interface PixelData {
	data: Uint8ClampedArray
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
