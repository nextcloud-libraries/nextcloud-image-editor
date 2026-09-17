/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { imageWorker } from './image-worker.ts'
import { t } from './l10n.ts'

/**
 * A decoded image the editor can draw: a bitmap where the worker
 * decoded it, an element where it had to be done here.
 */
export type SourceImage = HTMLImageElement | ImageBitmap

/**
 * The pixel size of a decoded image or a canvas.
 *
 * An <img> reports its own size under a different name, and is matched
 * on carrying that name rather than on its type: an element from
 * another document fails an instanceof against this realm's.
 *
 * @param image the decoded image or canvas
 */
export function imageSize(image: SourceImage | HTMLCanvasElement): { width: number, height: number } {
	return 'naturalWidth' in image
		? { width: image.naturalWidth, height: image.naturalHeight }
		: { width: image.width, height: image.height }
}

/**
 * Whether a URL points at another origin, in which case the image has
 * to be fetched with CORS or it taints the canvas and exporting throws
 * a SecurityError.
 *
 * Only genuinely remote sources qualify. Marking a same-origin request
 * anonymous strips the session cookie from it, and Nextcloud hands out
 * absolute same-origin URLs as a matter of course: generateRemoteUrl()
 * returns one, and a WebDAV address without credentials is a 401.
 *
 * @param url the source URL, absolute or relative
 */
function needsCors(url: string): boolean {
	let target: URL
	try {
		target = new URL(url, window.location.href)
	} catch {
		return false
	}
	return (target.protocol === 'http:' || target.protocol === 'https:')
		&& target.origin !== window.location.origin
}

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
			if (needsCors(url)) {
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
 * The bytes behind a source, where they can be had without giving up
 * what an <img> would do: a Blob is already bytes, and a URL is fetched
 * under the same cross-origin rules {@link needsCors} applies.
 *
 * @param source the image to read
 */
async function sourceBytes(source: Blob | string): Promise<Blob | null> {
	if (typeof source !== 'string') {
		return source
	}
	try {
		const response = await fetch(source, needsCors(source)
			? { mode: 'cors', credentials: 'omit' }
			: { credentials: 'same-origin' })
		return response.ok ? await response.blob() : null
	} catch {
		return null
	}
}

/**
 * Decode an image, off the main thread where the browser allows it.
 *
 * A JPEG is decoded lazily, inside whichever draw touches it first, and
 * that draw is on the main thread: measured on a phone-class CPU, the
 * first draw of a 12 Mpx photo stalled the thread for 497ms with the
 * loading spinner frozen on screen. Asking a worker for the bitmap
 * moves that cost off the thread entirely. Everything the worker cannot
 * do falls back to an <img>, which is what the editor always did.
 *
 * @param source the image to load
 */
export async function decodeImage(source: Blob | string): Promise<SourceImage> {
	const worker = imageWorker()
	if (worker !== null) {
		const bytes = await sourceBytes(source)
		if (bytes !== null) {
			try {
				return await worker.decode(bytes)
			} catch {
				// A format the worker could not decode is still worth
				// handing to an <img>, which knows more formats
			}
		}
	}
	return await loadImage(source)
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
