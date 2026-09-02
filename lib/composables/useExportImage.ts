/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { EditorState } from '../editor/state.ts'
import type { ExportOptions, ExportResult } from '../types/export.ts'

import { renderToCanvas } from '../editor/render.ts'
import { isPristine } from '../editor/state.ts'
import { canvasToBlob } from '../utils/image.ts'
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
	 * Export the edited image.
	 *
	 * @param options target format, quality and size bound
	 */
	exportImage(options?: ExportOptions): Promise<ExportResult>
	/** Export and hand the result to the save callback */
	save(): Promise<void>
}

/**
 * Exporting runs through the same scene renderer as the interactive
 * view, at natural resolution.
 *
 * @param deps image access and result callbacks
 */
export function useExportImage(deps: ExportDeps): ExportImage {
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
			return { blob: source, width: oriented.width, height: oriented.height, mimeType: source.type }
		}

		const canvas = renderToCanvas(oriented, deps.getState(), options.maxSize)
		const mimeType = options.format ?? 'image/png'
		try {
			const blob = await canvasToBlob(canvas, mimeType, options.quality)
			return { blob, width: canvas.width, height: canvas.height, mimeType }
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

	return { exportImage, save }
}
