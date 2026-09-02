/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { EditorState } from '../lib/editor/state.ts'
import type { ExportOptions, ExportResult } from '../lib/types/export.ts'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { useExportImage } from '../lib/composables/useExportImage.ts'
import * as render from '../lib/editor/render.ts'
import { createInitialState } from '../lib/editor/state.ts'

/**
 * An export composable over a stubbed image. The pass-through path
 * never draws, so a canvas of the right size is all it needs.
 *
 * @param source the source bytes, or null for a URL source
 * @param state the edit state to report
 * @param saveOptions what the save button asks for
 */
function setup(source: Blob | null, state: EditorState = createInitialState(), saveOptions: ExportOptions = {}) {
	const saved: ExportResult[] = []
	const errors: Error[] = []
	const api = useExportImage({
		oriented: () => ({ width: 200, height: 100 }) as HTMLCanvasElement,
		getState: () => state,
		source: () => source,
		saveOptions: () => saveOptions,
		onSaved: (result) => saved.push(result),
		onError: (error) => errors.push(error),
	})
	return { ...api, saved, errors }
}

describe('useExportImage', () => {
	afterEach(() => vi.restoreAllMocks())

	it('hands an untouched source straight back', async () => {
		const source = new Blob(['original bytes'], { type: 'image/jpeg' })
		const result = await setup(source).exportImage()

		expect(result.blob).toBe(source)
		expect(result.mimeType).toBe('image/jpeg')
		expect(result).toMatchObject({ width: 200, height: 100 })
	})

	it('re-encodes once an edit has been made', async () => {
		const source = new Blob(['original bytes'], { type: 'image/jpeg' })
		const edited = { ...createInitialState(), rotation: 90 as const }

		// Rendering needs a real canvas, which jsdom has none of: the
		// point is that the source is no longer the answer
		await expect(setup(source, edited).exportImage()).rejects.toThrow()
	})

	it('re-encodes when a different format is asked for', async () => {
		const source = new Blob(['original bytes'], { type: 'image/jpeg' })
		await expect(setup(source).exportImage({ format: 'image/webp' })).rejects.toThrow()
	})

	it('re-encodes when the output has to be bounded', async () => {
		const source = new Blob(['original bytes'], { type: 'image/jpeg' })
		await expect(setup(source).exportImage({ maxSize: 100 })).rejects.toThrow()
	})

	it('passes through when the requested format is the source format', async () => {
		const source = new Blob(['original bytes'], { type: 'image/png' })
		const result = await setup(source).exportImage({ format: 'image/png' })
		expect(result.blob).toBe(source)
	})

	it('cannot pass through a source of unknown type', async () => {
		await expect(setup(new Blob(['bytes'])).exportImage()).rejects.toThrow()
	})

	it('cannot pass through a source it never saw the bytes of', async () => {
		await expect(setup(null).exportImage()).rejects.toThrow()
	})

	it('reports no image at all as an error to the caller', async () => {
		const api = useExportImage({
			oriented: () => null,
			getState: () => createInitialState(),
			source: () => null,
			saveOptions: () => ({}),
			onSaved: vi.fn(),
			onError: vi.fn(),
		})
		await expect(api.exportImage()).rejects.toThrow('No image loaded')
	})

	it('explains a canvas it is not allowed to read', async () => {
		const canvas = { width: 10, height: 10, toBlob: () => {
			throw new DOMException('Tainted canvases may not be exported', 'SecurityError')
		} } as unknown as HTMLCanvasElement
		vi.spyOn(render, 'renderToCanvas').mockReturnValue(canvas)

		// The encoder's SecurityError says nothing about why, and the
		// answer is in how the source was served
		await expect(setup(null).exportImage()).rejects.toThrow('cross-origin access')
	})

	it('lets any other export failure through as it is', async () => {
		const canvas = { width: 10, height: 10, toBlob: (callback: (blob: Blob | null) => void) => callback(null) } as unknown as HTMLCanvasElement
		vi.spyOn(render, 'renderToCanvas').mockReturnValue(canvas)

		await expect(setup(null).exportImage()).rejects.toThrow('Canvas could not be encoded')
	})

	it('saves with the options the host asked for', async () => {
		const source = new Blob(['original bytes'], { type: 'image/png' })
		// A format matching the source keeps the save on the fast path
		const api = setup(source, createInitialState(), { format: 'image/png' })
		await api.save()

		expect(api.errors).toEqual([])
		expect(api.saved).toHaveLength(1)
		expect(api.saved[0]!.blob).toBe(source)
	})
})
