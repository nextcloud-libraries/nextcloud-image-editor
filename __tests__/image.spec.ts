/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { ImageWorkerClient } from '../lib/utils/image-worker.ts'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { imageWorker } from '../lib/utils/image-worker.ts'
import { canvasToBlob, decodeImage, imageSize, loadImage } from '../lib/utils/image.ts'

vi.mock('../lib/utils/image-worker.ts', () => ({ imageWorker: vi.fn(() => null) }))

/** The worker the next decode will find, or null for a browser without one */
function withWorker(client: Partial<ImageWorkerClient> | null): void {
	vi.mocked(imageWorker).mockReturnValue(client as ImageWorkerClient | null)
}

/** Every fake image built during a test, newest last */
let built: FakeImage[] = []

/** How the next image reports back */
let outcome: 'load' | 'error' = 'load'

/**
 * Stands in for HTMLImageElement: jsdom never fetches anything, so the
 * outcome is decided here.
 */
class FakeImage {
	public crossOrigin: string | null = null
	public onload: (() => void) | null = null
	public onerror: (() => void) | null = null
	public naturalWidth = 200
	public naturalHeight = 100
	private source = ''

	constructor() {
		built.push(this)
	}

	get src(): string {
		return this.source
	}

	set src(value: string) {
		this.source = value
		queueMicrotask(() => (outcome === 'load' ? this.onload?.() : this.onerror?.()))
	}
}

/** jsdom implements neither, so they are installed rather than spied on */
let createObjectURL = vi.fn<(source: Blob) => string>()
let revokeObjectURL = vi.fn<(url: string) => void>()

beforeEach(() => {
	built = []
	outcome = 'load'
	createObjectURL = vi.fn(() => 'blob:http://localhost:3000/fixture')
	revokeObjectURL = vi.fn()
	vi.stubGlobal('Image', FakeImage)
	Object.assign(URL, { createObjectURL, revokeObjectURL })
})

afterEach(() => {
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
	Reflect.deleteProperty(URL, 'createObjectURL')
	Reflect.deleteProperty(URL, 'revokeObjectURL')
})

describe('loadImage', () => {
	it('leaves a relative URL alone', async () => {
		await loadImage('/remote.php/dav/files/admin/photo.jpg')
		expect(built[0]!.crossOrigin).toBeNull()
	})

	it('leaves an absolute same-origin URL alone', async () => {
		// generateRemoteUrl() hands out exactly this shape, and marking
		// it anonymous drops the session cookie and earns a 401
		await loadImage(`${window.location.origin}/remote.php/dav/files/admin/photo.jpg`)
		expect(built[0]!.crossOrigin).toBeNull()
	})

	it('asks for CORS on another origin', async () => {
		await loadImage('https://cdn.example.com/photo.jpg')
		expect(built[0]!.crossOrigin).toBe('anonymous')
	})

	it('leaves a data URL alone', async () => {
		await loadImage('data:image/png;base64,AAAA')
		expect(built[0]!.crossOrigin).toBeNull()
	})

	it('loads bytes through an object URL and releases it again', async () => {
		const source = new Blob(['bytes'], { type: 'image/png' })
		await loadImage(source)

		expect(createObjectURL).toHaveBeenCalledWith(source)
		expect(revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost:3000/fixture')
		expect(built[0]!.crossOrigin).toBeNull()
	})

	it('releases the object URL even when decoding fails', async () => {
		outcome = 'error'
		await expect(loadImage(new Blob(['bytes']))).rejects.toThrow()
		expect(revokeObjectURL).toHaveBeenCalled()
	})

	it('rejects with a translated message when the source cannot be decoded', async () => {
		outcome = 'error'
		await expect(loadImage('/broken.png')).rejects.toThrow('Image could not be decoded')
	})
})

describe('canvasToBlob', () => {
	/** What the last encode was asked for */
	let encoded: { type?: string, quality?: number } = {}

	/**
	 * A canvas whose encoder reports the given blob.
	 *
	 * @param blob what toBlob hands to its callback
	 */
	function canvas(blob: Blob | null) {
		return {
			toBlob: (callback: (result: Blob | null) => void, type?: string, quality?: number) => {
				encoded = { type, quality }
				callback(blob)
			},
		} as unknown as HTMLCanvasElement
	}

	it('resolves with the encoded bytes', async () => {
		const blob = new Blob(['png'], { type: 'image/png' })
		await expect(canvasToBlob(canvas(blob))).resolves.toBe(blob)
	})

	it('defaults to PNG and passes the format through', async () => {
		await canvasToBlob(canvas(new Blob([])))
		expect(encoded.type).toBe('image/png')

		await canvasToBlob(canvas(new Blob([])), 'image/jpeg', 0.8)
		expect(encoded).toEqual({ type: 'image/jpeg', quality: 0.8 })
	})

	it('rejects where the encoder produced nothing', async () => {
		await expect(canvasToBlob(canvas(null))).rejects.toThrow('Canvas could not be encoded')
	})
})

describe('imageSize', () => {
	it('reads an element by its natural size and a bitmap by its own', () => {
		expect(imageSize({ naturalWidth: 200, naturalHeight: 100 } as HTMLImageElement)).toEqual({ width: 200, height: 100 })
		expect(imageSize({ width: 64, height: 48 } as ImageBitmap)).toEqual({ width: 64, height: 48 })
	})
})

describe('decodeImage', () => {
	it('decodes bytes in the worker, where there is one', async () => {
		const bitmap = { width: 200, height: 100 } as ImageBitmap
		const decode = vi.fn(async () => bitmap)
		withWorker({ decode })
		const blob = new Blob(['bytes'], { type: 'image/jpeg' })

		await expect(decodeImage(blob)).resolves.toBe(bitmap)
		expect(decode).toHaveBeenCalledWith(blob)
		// Nothing was handed to an <img>, which is where the decode used
		// to happen on the main thread
		expect(built).toHaveLength(0)
	})

	it('fetches a URL before handing the bytes over', async () => {
		const bitmap = { width: 10, height: 10 } as ImageBitmap
		const blob = new Blob(['bytes'], { type: 'image/jpeg' })
		const fetched = vi.fn(async () => ({ ok: true, blob: async () => blob }) as unknown as Response)
		vi.stubGlobal('fetch', fetched)
		withWorker({ decode: async () => bitmap })

		await expect(decodeImage('/photo.jpg')).resolves.toBe(bitmap)
		// Same origin keeps the session cookie, which a Nextcloud URL needs
		expect(fetched).toHaveBeenCalledWith('/photo.jpg', { credentials: 'same-origin' })
	})

	it('asks for another origin the way the <img> did', async () => {
		const blob = new Blob(['bytes'], { type: 'image/jpeg' })
		const fetched = vi.fn(async () => ({ ok: true, blob: async () => blob }) as unknown as Response)
		vi.stubGlobal('fetch', fetched)
		withWorker({ decode: async () => ({ width: 1, height: 1 }) as ImageBitmap })

		await decodeImage('https://elsewhere.example/photo.jpg')
		expect(fetched).toHaveBeenCalledWith('https://elsewhere.example/photo.jpg', { mode: 'cors', credentials: 'omit' })
	})

	it('falls back to an element where there is no worker', async () => {
		withWorker(null)
		const image = await decodeImage(new Blob(['bytes'], { type: 'image/jpeg' }))

		expect(built).toHaveLength(1)
		expect(imageSize(image)).toEqual({ width: 200, height: 100 })
	})

	it('falls back to an element when the worker cannot decode', async () => {
		withWorker({
			decode: async () => {
				throw new Error('unsupported format')
			},
		})
		await decodeImage(new Blob(['bytes'], { type: 'image/heic' }))

		// An <img> knows formats the worker does not, so a refusal there
		// is not the end of the road
		expect(built).toHaveLength(1)
	})

	it('falls back to an element when the bytes cannot be fetched', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false }) as Response))
		withWorker({ decode: vi.fn() })

		await decodeImage('/missing.jpg')
		expect(built).toHaveLength(1)
	})
})
