/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { levelFor } from '../lib/editor/mipmap.ts'

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
