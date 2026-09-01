/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { t } from './l10n.ts'

/**
 * Load a decoded image element from a Blob, File or URL.
 *
 * @param source the image to load
 */
export async function loadImage(source: Blob | string): Promise<HTMLImageElement> {
	const url = typeof source === 'string' ? source : URL.createObjectURL(source)
	try {
		return await new Promise((resolve, reject) => {
			const image = new Image()
			// Remote images must be CORS-clean, otherwise they taint the
			// canvas and exporting throws a SecurityError
			if (/^https?:/.test(url)) {
				image.crossOrigin = 'anonymous'
			}
			image.onload = () => resolve(image)
			image.onerror = () => reject(new Error(t('Image could not be decoded')))
			image.src = url
		})
	} finally {
		if (typeof source !== 'string') {
			URL.revokeObjectURL(url)
		}
	}
}

/**
 * Promisified HTMLCanvasElement.toBlob.
 *
 * @param canvas the canvas to encode
 * @param type target MIME type
 * @param quality encoder quality between 0 and 1, only for lossy formats
 */
export async function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (blob === null) {
				reject(new Error(t('Canvas could not be encoded')))
				return
			}
			resolve(blob)
		}, type, quality)
	})
}
