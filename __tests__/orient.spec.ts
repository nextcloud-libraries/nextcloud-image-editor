/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { EditorState } from '../lib/editor/state.ts'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { orientImage } from '../lib/editor/orient.ts'
import { createInitialState } from '../lib/editor/state.ts'

/** Every call the bake made on the 2D context, in order */
let calls: string[] = []

/** The canvas the bake drew on */
let target: HTMLCanvasElement

beforeEach(() => {
	calls = []
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function mock(this: HTMLCanvasElement) {
		// eslint-disable-next-line @typescript-eslint/no-this-alias -- the canvas under test is the receiver
		const canvas = this
		target = canvas
		return {
			translate: (x: number, y: number) => calls.push(`translate(${x}, ${y})`),
			rotate: (angle: number) => calls.push(`rotate(${(angle * 180) / Math.PI})`),
			scale: (x: number, y: number) => calls.push(`scale(${Number(x.toFixed(4))}, ${Number(y.toFixed(4))})`),
			drawImage: (_image: unknown, x: number, y: number) => calls.push(`drawImage(${x}, ${y})`),
		} as unknown as CanvasRenderingContext2D
	})
})

/**
 * A decoded image of the given size.
 *
 * @param width natural width
 * @param height natural height
 */
function image(width = 200, height = 100): HTMLImageElement {
	return { naturalWidth: width, naturalHeight: height } as HTMLImageElement
}

/**
 * @param overrides the parts of the state the bake reads
 */
function state(overrides: Partial<EditorState> = {}) {
	return { ...createInitialState(), ...overrides }
}

/**
 * Bake an image and report the calls that one bake made, so a test can
 * compare two of them without the first one's calls in the way.
 *
 * @param overrides the state to bake with
 * @param source the image to bake, defaulting to 200x100
 */
function bake(overrides: Partial<EditorState> = {}, source = image()): string[] {
	calls = []
	orientImage(source, state(overrides))
	return calls
}

describe('orientImage', () => {
	it('bakes an untouched image at its natural size', () => {
		const calls = bake()

		expect(target.width).toBe(200)
		expect(target.height).toBe(100)
		// Centre, no turn, no cover, no mirror, then the image itself
		expect(calls).toEqual([
			'translate(100, 50)',
			'rotate(0)',
			'scale(1, 1)',
			'rotate(0)',
			'scale(1, 1)',
			'drawImage(-100, -50)',
		])
	})

	it('swaps the canvas dimensions on a quarter turn', () => {
		bake({ rotation: 90 })
		expect([target.width, target.height]).toEqual([100, 200])

		bake({ rotation: 270 })
		expect([target.width, target.height]).toEqual([100, 200])
	})

	it('keeps the natural dimensions on a half turn', () => {
		bake({ rotation: 180 })
		expect([target.width, target.height]).toEqual([200, 100])
	})

	it('applies the transforms in the order the coordinates assume', () => {
		const calls = bake({ rotation: 90, fineRotation: 10, flipX: true })

		// Fine rotation outermost, then the cover scale it needs, then
		// the quarter turn, then the mirror closest to the pixels: every
		// downstream coordinate depends on this order
		expect(calls[1]).toBe('rotate(10)')
		expect(calls[2]).toMatch(/^scale\(1\.\d+, 1\.\d+\)$/)
		expect(calls[3]).toBe('rotate(90)')
		expect(calls[4]).toBe('scale(-1, 1)')
		expect(calls[5]).toBe('drawImage(-100, -50)')
	})

	it('mirrors each axis on its own', () => {
		expect(bake({ flipY: true })[4]).toBe('scale(1, -1)')
		expect(bake({ flipX: true })[4]).toBe('scale(-1, 1)')
		expect(bake({ flipX: true, flipY: true })[4]).toBe('scale(-1, -1)')
	})

	it('scales the content up to cover the frame it turns inside', () => {
		const cover = bake({ fineRotation: 45 })[2]!.match(/scale\(([\d.]+)/)![1]!
		expect(Number(cover)).toBeGreaterThan(1)
	})

	it('multiplies the zoom into the cover scale', () => {
		expect(bake({ zoom: 2 })[2]).toBe('scale(2, 2)')
	})

	it('ignores a zoom below the fitted view', () => {
		expect(bake({ zoom: 0.5 })[2]).toBe('scale(1, 1)')
	})

	it('reports a canvas it cannot draw on', () => {
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
		expect(() => orientImage(image(), state())).toThrow('Canvas 2D context unavailable')
	})
})
