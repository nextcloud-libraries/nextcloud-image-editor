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
import { jpegBlobAtQuality } from './jpeg-fixture.ts'

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

/**
 * Stand in for the export canvas and record what the encoder was asked
 * for, which is the only place the chosen quality is observable.
 */
function recordingCanvas(): { asked: { type?: string, quality?: number } } {
	const asked: { type?: string, quality?: number } = {}
	const canvas = {
		width: 200,
		height: 100,
		toBlob: (callback: (blob: Blob | null) => void, type?: string, quality?: number) => {
			asked.type = type
			asked.quality = quality
			callback(new Blob([Uint8Array.from([0xFF, 0xD8, 0xFF, 0xD9])], { type }))
		},
	} as unknown as HTMLCanvasElement
	vi.spyOn(render, 'renderToCanvas').mockReturnValue(canvas)
	return { asked }
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

	it('reports progress across a render that holds the thread', async () => {
		const source = new Blob(['original bytes'], { type: 'image/jpeg' })
		const edited = { ...createInitialState(), rotation: 90 as const }
		const api = setup(source, edited)
		const seen: boolean[] = []

		// Rendering needs a real canvas, so this fails; what matters is
		// that the flag went up before the work and came down after it
		expect(api.exporting.value).toBe(false)
		const running = api.exportImage().catch(() => seen.push(api.exporting.value))
		seen.push(api.exporting.value)
		await running

		expect(seen).toEqual([true, false])
	})

	it('reports no progress for a source handed straight back', async () => {
		const source = new Blob(['original bytes'], { type: 'image/jpeg' })
		const api = setup(source)

		const running = api.exportImage()
		// The fast path never blocks, so it never claims to be busy
		expect(api.exporting.value).toBe(false)
		await running
		expect(api.exporting.value).toBe(false)
	})
	describe('the quality a JPEG is written at', () => {
		const edited = { ...createInitialState(), rotation: 90 as const }

		it('matches what the source was written at', async () => {
			const { asked } = recordingCanvas()
			await setup(jpegBlobAtQuality(85), edited).exportImage()

			// The setting itself is nowhere in the file; it is read back
			// from the quantization table it produced
			expect(asked.type).toBe('image/jpeg')
			expect(asked.quality).toBeCloseTo(0.85)
		})

		it('is capped, so a source written at 100 does not double the file', async () => {
			const { asked } = recordingCanvas()
			await setup(jpegBlobAtQuality(100), edited).exportImage()
			expect(asked.quality).toBeCloseTo(0.97)
		})

		it('has a floor, so a battered source is not battered again', async () => {
			const { asked } = recordingCanvas()
			await setup(jpegBlobAtQuality(40), edited).exportImage()
			expect(asked.quality).toBeCloseTo(0.75)
		})

		it('falls back where there is no source to read', async () => {
			const { asked } = recordingCanvas()
			await setup(null, edited).exportImage({ format: 'image/jpeg' })
			expect(asked.quality).toBeCloseTo(0.92)
		})

		it('gives way to the host', async () => {
			const { asked } = recordingCanvas()
			await setup(jpegBlobAtQuality(85), edited).exportImage({ quality: 0.5 })
			expect(asked.quality).toBeCloseTo(0.5)
		})

		it('is not invented for a format that has no use for it', async () => {
			const { asked } = recordingCanvas()
			await setup(jpegBlobAtQuality(85), edited).exportImage({ format: 'image/png' })
			expect(asked.type).toBe('image/png')
			expect(asked.quality).toBeUndefined()
		})
	})
})
