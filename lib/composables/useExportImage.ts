/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { EditorState } from '../editor/state.ts'
import type { ExportOptions, ExportResult } from '../types/index.ts'

import { renderToCanvas } from '../editor/render.ts'
import { canvasToBlob } from '../utils/image.ts'

export interface ExportDeps {
	/** The orientation-baked source canvas */
	oriented(): HTMLCanvasElement | null
	getState(): EditorState
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
		const canvas = renderToCanvas(oriented, deps.getState(), options.maxSize)
		const mimeType = options.format ?? 'image/png'
		const blob = await canvasToBlob(canvas, mimeType, options.quality)
		return { blob, width: canvas.width, height: canvas.height, mimeType }
	}

	/**
	 * Export and hand the result to the save callback.
	 */
	async function save(): Promise<void> {
		try {
			deps.onSaved(await exportImage())
		} catch (error) {
			deps.onError(error instanceof Error ? error : new Error(String(error)))
		}
	}

	return { exportImage, save }
}
