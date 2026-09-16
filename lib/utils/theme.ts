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
 * Tiny blurred copy of the image as a data URL, used as the ambient
 * backdrop behind the editor card.
 *
 * @param canvas the image to sample
 */
export function ambientBackdrop(canvas: HTMLCanvasElement | HTMLImageElement): string {
	const sample = document.createElement('canvas')
	const width = canvas instanceof HTMLImageElement ? canvas.naturalWidth : canvas.width
	const height = canvas instanceof HTMLImageElement ? canvas.naturalHeight : canvas.height
	// An SVG without intrinsic size decodes with zero dimensions
	if (width === 0 || height === 0) {
		return ''
	}
	sample.width = 24
	sample.height = Math.max(1, Math.round((24 * height) / width))
	const context = sample.getContext('2d')
	if (context === null) {
		return ''
	}
	context.drawImage(canvas, 0, 0, sample.width, sample.height)
	try {
		return sample.toDataURL()
	} catch {
		// Same as above: a tainted canvas cannot be exported, and the
		// wallpaper is not worth an exception
		return ''
	}
}
