/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Ref } from 'vue'
import type { EditorState } from '../editor/state.ts'
import type { ExportOptions, ExportResult } from '../types/export.ts'

import { ref } from 'vue'
import { renderToCanvas, visibleRect } from '../editor/render.ts'
import { isPristine } from '../editor/state.ts'
import { convertsToSrgb } from '../utils/color-space.ts'
import { canvasToBlob } from '../utils/image.ts'
import { estimateJpegQuality, readMetadataSegments, withMetadata } from '../utils/jpeg.ts'
import { t } from '../utils/l10n.ts'

export interface ExportDeps {
	/** The orientation-baked source canvas */
	oriented(): HTMLCanvasElement | null
	getState(): EditorState
	/**
	 * The source bytes, where the editor was handed bytes rather than a
	 * URL. An untouched image is returned from here instead of being
	 * rendered again.
	 */
	source(): Blob | null
	/** Format, quality and size bound the save button asks for */
	saveOptions(): ExportOptions
	onSaved(result: ExportResult): void
	onError(error: Error): void
}

export interface ExportImage {
	/**
	 * True while an export is running. Rendering a large image at
	 * natural resolution takes long enough to need saying: two thirds
	 * of a second for a seven megabyte photo.
	 */
	exporting: Ref<boolean>
	/**
	 * Export the edited image.
	 *
	 * @param options target format, quality and size bound
	 */
	exportImage(options?: ExportOptions): Promise<ExportResult>
	/** Export and hand the result to the save callback */
	save(): Promise<void>
}

/**
 * What a JPEG is written at when the source says nothing: the setting
 * Chromium picks for itself, so nothing changes for a host that was
 * happy with what it got.
 */
const DEFAULT_QUALITY = 0.92

/**
 * Bounds on a setting taken from the source. The floor keeps a heavily
 * compressed source from having its own damage re-applied to pixels
 * that have since been filtered and resampled; the ceiling keeps a
 * file written at 100 from doubling in size for a difference of a
 * fraction of a decibel.
 */
const MIN_QUALITY = 0.75
const MAX_QUALITY = 0.97

/**
 * Wait for the browser to paint.
 *
 * The render that follows holds the main thread, so without this the
 * spinner would be set and then never drawn: the frame it was supposed
 * to appear in is the frame the export eats.
 */
async function painted(): Promise<void> {
	await new Promise((resolve) => {
		requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))
	})
}

/**
 * Exporting runs through the same scene renderer as the interactive
 * view, at natural resolution.
 *
 * @param deps image access and result callbacks
 */
export function useExportImage(deps: ExportDeps): ExportImage {
	const exporting = ref(false)

	/** What the encoder can write, so an unknown source type is not asked for */
	const ENCODABLE = ['image/jpeg', 'image/png', 'image/webp']

	/**
	 * The format to save in when the host has not asked for one: the one
	 * the image arrived in. A photo that came in as a JPEG goes back out
	 * as a JPEG, which keeps the file a sensible size and leaves somewhere
	 * for its metadata to live. Anything the encoder cannot write, such as
	 * HEIC, falls through to the caller's default.
	 */
	function sourceFormat(): string | undefined {
		const type = deps.source()?.type
		return type !== undefined && ENCODABLE.includes(type) ? type : undefined
	}

	/**
	 * The source bytes, where they are a JPEG and a JPEG is what is
	 * being written. Both the metadata and the quality come from here,
	 * and the editor only has them when it was handed a Blob rather
	 * than a URL.
	 *
	 * @param mimeType the format being encoded
	 */
	async function jpegSource(mimeType: string): Promise<Uint8Array | null> {
		const source = deps.source()
		if (source === null || mimeType !== 'image/jpeg' || source.type !== 'image/jpeg') {
			return null
		}
		return new Uint8Array(await source.arrayBuffer())
	}

	/**
	 * How hard to compress, when the host has not said.
	 *
	 * Left to itself the browser picks, and the two do not pick the
	 * same thing, so the same edit came out as two different files.
	 * Matching what the source was written at is the answer that keeps
	 * an edited photo looking like the one that was opened: the setting
	 * is not stored anywhere, but the quantization table it produced
	 * is, and {@link estimateJpegQuality} reads it back.
	 *
	 * @param source the source JPEG bytes, or null where there are none
	 */
	function qualityFor(source: Uint8Array | null): number {
		const estimated = source === null ? undefined : estimateJpegQuality(source)
		if (estimated === undefined) {
			return DEFAULT_QUALITY
		}
		return Math.min(MAX_QUALITY, Math.max(MIN_QUALITY, estimated / 100))
	}

	/**
	 * Carry what the camera recorded into the exported JPEG.
	 *
	 * A canvas holds pixels and nothing else, so an encoded blob starts
	 * with no capture date, no camera, no location and no colour profile.
	 *
	 * @param blob the freshly encoded image
	 * @param canvas the canvas it was encoded from
	 * @param source the source JPEG bytes, or null where there are none
	 */
	async function carryMetadata(blob: Blob, canvas: HTMLCanvasElement, source: Uint8Array | null): Promise<Blob> {
		// An encoder handed a type it cannot write falls back to PNG, and
		// a JPEG's blocks have no business in one
		if (source === null || blob.type !== 'image/jpeg') {
			return blob
		}
		// The colour profile goes only where it is still true. A browser
		// that decodes a wide-gamut photo into sRGB leaves the canvas
		// holding sRGB numbers, and the source's profile over those says
		// they are something they are not: measured on a Display P3
		// photo, Chromium exported it a visible step more saturated. A
		// browser that hands the samples over untouched leaves them in
		// the source's space, where the profile is the only thing that
		// makes the file readable.
		const segments = readMetadataSegments(source, { icc: !convertsToSrgb() })
		if (segments.length === 0) {
			return blob
		}
		const carried = withMetadata(
			new Uint8Array(await blob.arrayBuffer()),
			segments,
			{ width: canvas.width, height: canvas.height },
		)
		return new Blob([carried as unknown as BlobPart], { type: blob.type })
	}

	/**
	 * Render the state at natural resolution and encode it.
	 *
	 * @param options target format, quality and size bound
	 */
	async function exportImage(options: ExportOptions = {}): Promise<ExportResult> {
		const oriented = deps.oriented()
		if (oriented === null) {
			throw new Error('No image loaded')
		}

		// Nothing was edited and nothing was asked of the encoder, so the
		// source is already the answer. Re-encoding it would cost a
		// generation of quality and throw away the metadata, EXIF and
		// colour profile included, for no change at all.
		const source = deps.source()
		if (source !== null
			&& source.type !== ''
			&& isPristine(deps.getState())
			&& options.maxSize === undefined
			&& (options.format === undefined || options.format === source.type)) {
			// The untouched source is handed back whole, so nothing was lost
			// to the canvas cap even where the editor had to work smaller
			return { blob: source, width: oriented.width, height: oriented.height, mimeType: source.type, downscaled: false }
		}

		exporting.value = true
		await painted()
		try {
			return await encode(oriented, options)
		} finally {
			exporting.value = false
		}
	}

	/**
	 * Render the state at natural resolution and encode it, with no
	 * regard for how long it holds the thread.
	 *
	 * @param oriented the orientation-baked source canvas
	 * @param options target format, quality and size bound
	 */
	async function encode(oriented: HTMLCanvasElement, options: ExportOptions): Promise<ExportResult> {
		const canvas = renderToCanvas(oriented, deps.getState(), options.maxSize)
		const mimeType = options.format ?? sourceFormat() ?? 'image/png'
		try {
			const source = await jpegSource(mimeType)
			const quality = options.quality ?? (mimeType === 'image/jpeg' ? qualityFor(source) : undefined)
			let blob = await canvasToBlob(canvas, mimeType, quality)
			blob = await carryMetadata(blob, canvas, source)
			const visible = visibleRect(deps.getState(), { width: oriented.width, height: oriented.height })
			const wanted = options.maxSize === undefined
				? Math.max(visible.width, visible.height)
				: Math.min(options.maxSize, Math.max(visible.width, visible.height))
			return {
				blob,
				width: canvas.width,
				height: canvas.height,
				mimeType,
				downscaled: Math.max(canvas.width, canvas.height) < Math.floor(wanted),
			}
		} catch (error) {
			// A canvas holding pixels from an image fetched without CORS
			// cannot be read back at all. The encoder's SecurityError says
			// nothing about why, and the answer is in how the source was
			// served rather than anything the user did.
			if (error instanceof DOMException && error.name === 'SecurityError') {
				throw new Error(
					t('The image cannot be exported because it was loaded without cross-origin access'),
					{ cause: error },
				)
			}
			throw error
		}
	}

	/**
	 * Export and hand the result to the save callback.
	 */
	async function save(): Promise<void> {
		try {
			deps.onSaved(await exportImage(deps.saveOptions()))
		} catch (error) {
			deps.onError(error instanceof Error ? error : new Error(String(error)))
		}
	}

	return { exporting, exportImage, save }
}
