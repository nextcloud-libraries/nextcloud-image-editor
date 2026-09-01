/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * The Nextcloud primary color of the active theme, for canvas chrome
 * that cannot use CSS variables directly.
 */
export function primaryColor(): string {
	const value = getComputedStyle(document.body).getPropertyValue('--color-primary-element').trim()
	return value !== '' ? value : '#0082c9'
}

/**
 * Dominant color of an image as an "r, g, b" triplet for CSS rgba()
 * composition. Averages a tiny downsample, weighting colorful pixels
 * so the tint follows the subject rather than gray backgrounds.
 *
 * @param canvas the image to sample
 */
export function ambientColor(canvas: HTMLCanvasElement | HTMLImageElement): string {
	const sample = document.createElement('canvas')
	sample.width = 8
	sample.height = 8
	const context = sample.getContext('2d')
	if (context === null) {
		return '88, 86, 112'
	}
	context.drawImage(canvas, 0, 0, 8, 8)

	const { data } = context.getImageData(0, 0, 8, 8)
	let r = 0
	let g = 0
	let b = 0
	let total = 0
	for (let i = 0; i < data.length; i += 4) {
		const saturation = Math.max(data[i]!, data[i + 1]!, data[i + 2]!)
			- Math.min(data[i]!, data[i + 1]!, data[i + 2]!)
		const weight = saturation + 8
		r += data[i]! * weight
		g += data[i + 1]! * weight
		b += data[i + 2]! * weight
		total += weight
	}
	return `${Math.round(r / total)}, ${Math.round(g / total)}, ${Math.round(b / total)}`
}

/**
 * Tiny blurred copy of the image as a data URL, used as the ambient
 * backdrop behind the editor card.
 *
 * @param canvas the image to sample
 */
export function ambientBackdrop(canvas: HTMLCanvasElement | HTMLImageElement): string {
	const sample = document.createElement('canvas')
	const width = canvas instanceof HTMLImageElement ? canvas.naturalWidth : canvas.width
	const height = canvas instanceof HTMLImageElement ? canvas.naturalHeight : canvas.height
	sample.width = 24
	sample.height = Math.max(1, Math.round((24 * height) / width))
	const context = sample.getContext('2d')
	if (context === null) {
		return ''
	}
	context.drawImage(canvas, 0, 0, sample.width, sample.height)
	return sample.toDataURL()
}
