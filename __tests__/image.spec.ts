/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { canvasToBlob, loadImage } from '../lib/utils/image.ts'

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
