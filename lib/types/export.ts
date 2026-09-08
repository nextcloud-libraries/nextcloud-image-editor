/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export interface ExportOptions {
	/** Target MIME type, defaults to 'image/png' */
	format?: 'image/png' | 'image/jpeg' | 'image/webp'
	/** Encoder quality between 0 and 1, only for lossy formats */
	quality?: number
	/** Bound the longest output edge, never upscaling */
	maxSize?: number
}

export interface ExportResult {
	blob: Blob
	width: number
	height: number
	mimeType: string
	/**
	 * Whether the result is smaller than the source allowed for, because
	 * the image is larger than this browser will paint. The pixels that
	 * were dropped are not recoverable from the result, so a host that
	 * overwrites the original should say so first.
	 */
	downscaled: boolean
}
