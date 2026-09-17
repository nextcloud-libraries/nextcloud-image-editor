/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { ImageWorkerClient } from '../lib/utils/image-worker.ts'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { levelFor, prepareLevels } from '../lib/editor/mipmap.ts'
import { imageWorker } from '../lib/utils/image-worker.ts'

vi.mock('../lib/utils/image-worker.ts', () => ({ imageWorker: vi.fn(() => null) }))

/** The worker the next prebuild will find, or null for a browser without one */
function withWorker(client: Partial<ImageWorkerClient> | null): void {
	vi.mocked(imageWorker).mockReturnValue(client as ImageWorkerClient | null)
}

/** Every drawImage call made, as (source, target) canvas pairs */
const draws: { from: HTMLCanvasElement, to: HTMLCanvasElement }[] = []

/**
 * A canvas of the given size. jsdom has no 2D context, so the one
 * handed out only records what is drawn onto it.
 *
 * @param width canvas width
 * @param height canvas height
 */
function canvas(width: number, height: number): HTMLCanvasElement {
	const element = document.createElement('canvas')
	element.width = width
	element.height = height
	return element
}

beforeEach(() => {
	draws.length = 0
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function mock(this: HTMLCanvasElement) {
		// eslint-disable-next-line @typescript-eslint/no-this-alias -- the canvas being drawn on is the receiver
		const to = this
		return {
			imageSmoothingQuality: 'low',
			drawImage: (from: HTMLCanvasElement) => draws.push({ from, to }),
		} as unknown as CanvasRenderingContext2D
	})
})

describe('levelFor', () => {
	it('hands back the source itself when it is not shrunk by half or more', () => {
		const source = canvas(2000, 1500)
		expect(levelFor(source, 1)).toBe(source)
		expect(levelFor(source, 0.51)).toBe(source)
		expect(draws).toHaveLength(0)
	})

	it('halves as many times as the shrink allows, so what is drawn is shrunk by less than half', () => {
		const source = canvas(5000, 3300)
		// Fitted at 0.21 of its size: two halvings leave a copy drawn at 0.84
		const level = levelFor(source, 0.21)
		expect([level.width, level.height]).toEqual([1250, 825])
		// Each step draws from the previous one, not from the source
		expect(draws.map(({ from, to }) => [from.width, to.width])).toEqual([[5000, 2500], [2500, 1250]])
	})

	it('rounds odd sizes up so nothing is cut off the edge', () => {
		const level = levelFor(canvas(1001, 3), 0.4)
		expect([level.width, level.height]).toEqual([501, 2])
	})

	it('stops rather than shrinking to nothing', () => {
		const level = levelFor(canvas(4, 4), 0.001)
		expect([level.width, level.height]).toEqual([1, 1])
	})

	it('keeps halving a strip along its long side once the short one is a pixel', () => {
		expect(levelFor(canvas(1, 1000), 0.1).height).toBe(125)
		expect(levelFor(canvas(2, 1000), 0.1).height).toBe(125)
		const wide = levelFor(canvas(1000, 1), 0.1)
		expect([wide.width, wide.height]).toEqual([125, 1])
	})

	it('keeps the copies, so drawing at the same scale again costs nothing', () => {
		const source = canvas(4000, 3000)
		const first = levelFor(source, 0.2)
		expect(levelFor(source, 0.2)).toBe(first)
		expect(draws).toHaveLength(2)
		// A shallower level reuses the first halving too
		expect(levelFor(source, 0.4).width).toBe(2000)
		expect(draws).toHaveLength(2)
	})

	it('builds a new set for a new source', () => {
		levelFor(canvas(4000, 3000), 0.2)
		levelFor(canvas(4000, 3000), 0.2)
		expect(draws).toHaveLength(4)
	})
})

describe('prepareLevels', () => {
	it('builds the levels in the worker, so nothing is halved here', async () => {
		const source = canvas(2000, 1500)
		const levels = [
			{ width: 1000, height: 750 } as ImageBitmap,
			{ width: 500, height: 375 } as ImageBitmap,
			{ width: 250, height: 188 } as ImageBitmap,
			{ width: 125, height: 94 } as ImageBitmap,
		]
		const bitmap = { width: 2000, height: 1500 } as ImageBitmap
		vi.stubGlobal('createImageBitmap', vi.fn(async () => bitmap))
		withWorker({ levels: vi.fn(async () => levels) })

		await prepareLevels(source)
		expect(levelFor(source, 0.25)).toBe(levels[1])
		// Halving on the main thread is what this is here to avoid
		expect(draws).toHaveLength(0)
		vi.unstubAllGlobals()
	})

	it('leaves the main thread path alone where there is no worker', async () => {
		const source = canvas(2000, 1500)
		withWorker(null)

		await prepareLevels(source)
		expect(levelFor(source, 0.25)).not.toBe(source)
		expect(draws).toHaveLength(2)
	})

	it('says nothing and changes nothing when the worker fails', async () => {
		const source = canvas(2000, 1500)
		vi.stubGlobal('createImageBitmap', vi.fn(async () => {
			throw new Error('out of memory')
		}))
		withWorker({ levels: vi.fn() })

		await expect(prepareLevels(source)).resolves.toBeUndefined()
		// And the levels are still there to be had, the slow way
		expect(levelFor(source, 0.25)).not.toBe(source)
		vi.unstubAllGlobals()
	})
})
