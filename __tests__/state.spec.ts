/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { ArrowAnnotation, BoxAnnotation, DrawAnnotation, EditorState, TextAnnotation } from '../lib/editor/state.ts'

import { describe, expect, it } from 'vitest'
import {
	clampRect,
	createInitialState,
	duplicateAnnotation,
	flipHorizontal,
	flipVertical,
	orientedSize,
	rotateCW,
	translateAnnotation,
} from '../lib/editor/state.ts'

// 200x100 oriented space used across the tests
const ORIENTED = { width: 200, height: 100 }

const draw: DrawAnnotation = { id: 'd', type: 'draw', points: [10, 20, 30, 40], color: '#f00', strokeWidth: 4 }
const arrow: ArrowAnnotation = { id: 'a', type: 'arrow', points: [0, 0, 50, 50], color: '#f00', strokeWidth: 4 }
const box: BoxAnnotation = { id: 'b', type: 'rectangle', rect: { x: 10, y: 20, width: 30, height: 40 }, color: '#f00', strokeWidth: 4 }
const text: TextAnnotation = { id: 't', type: 'text', x: 50, y: 60, text: 'hi', color: '#f00', fontSize: 24, rotation: 0 }

function stateWith(partial: Partial<EditorState>): EditorState {
	return { ...createInitialState(), ...partial }
}

describe('orientedSize', () => {
	it('keeps size at 0 and 180 degrees', () => {
		expect(orientedSize(ORIENTED, 0)).toEqual(ORIENTED)
		expect(orientedSize(ORIENTED, 180)).toEqual(ORIENTED)
	})

	it('swaps size at 90 and 270 degrees', () => {
		expect(orientedSize(ORIENTED, 90)).toEqual({ width: 100, height: 200 })
		expect(orientedSize(ORIENTED, 270)).toEqual({ width: 100, height: 200 })
	})
})

describe('clampRect', () => {
	it('keeps a contained rect unchanged', () => {
		const rect = { x: 10, y: 10, width: 50, height: 50 }
		expect(clampRect(rect, ORIENTED)).toEqual(rect)
	})

	it('clamps position and size to the bounds', () => {
		expect(clampRect({ x: -10, y: 90, width: 500, height: 500 }, ORIENTED))
			.toEqual({ x: 0, y: 90, width: 200, height: 10 })
	})

	it('never collapses below 1px', () => {
		const clamped = clampRect({ x: 199, y: 99, width: 0, height: 0 }, ORIENTED)
		expect(clamped.width).toBe(1)
		expect(clamped.height).toBe(1)
	})
})

describe('rotateCW', () => {
	it('cycles the rotation field', () => {
		let state = createInitialState()
		for (const expected of [90, 180, 270, 0]) {
			state = rotateCW(state, ORIENTED)
			expect(state.rotation).toBe(expected)
		}
	})

	it('remaps the crop rect into the new space', () => {
		const state = stateWith({ crop: { x: 20, y: 10, width: 60, height: 30 } })
		// New space is 100x200; x' = H - y - h, y' = x, sizes swap
		expect(rotateCW(state, ORIENTED).crop).toEqual({ x: 60, y: 20, width: 30, height: 60 })
	})

	it('remaps draw and arrow points', () => {
		const state = stateWith({ annotations: [draw, arrow] })
		const rotated = rotateCW(state, ORIENTED)
		expect((rotated.annotations[0] as DrawAnnotation).points).toEqual([80, 10, 60, 30])
		expect((rotated.annotations[1] as ArrowAnnotation).points).toEqual([100, 0, 50, 50])
	})

	it('remaps boxes and turns text anchors', () => {
		const state = stateWith({ annotations: [box, text] })
		const rotated = rotateCW(state, ORIENTED)
		expect((rotated.annotations[0] as BoxAnnotation).rect).toEqual({ x: 40, y: 10, width: 40, height: 30 })
		const rotatedText = rotated.annotations[1] as TextAnnotation
		expect(rotatedText.x).toBe(40)
		expect(rotatedText.y).toBe(50)
		expect(rotatedText.rotation).toBe(90)
	})

	it('returns to the original coordinates after four rotations', () => {
		let state = stateWith({
			crop: { x: 20, y: 10, width: 60, height: 30 },
			annotations: [draw, arrow, box, text],
		})
		let oriented = { ...ORIENTED }
		for (let i = 0; i < 4; i++) {
			state = rotateCW(state, oriented)
			oriented = orientedSize(ORIENTED, state.rotation)
		}
		expect(state.rotation).toBe(0)
		expect(state.crop).toEqual({ x: 20, y: 10, width: 60, height: 30 })
		expect(state.annotations).toEqual([draw, arrow, box, text])
	})
})

describe('flipHorizontal', () => {
	it('toggles flipX and mirrors the crop', () => {
		const state = stateWith({ crop: { x: 20, y: 10, width: 60, height: 30 } })
		const flipped = flipHorizontal(state, ORIENTED)
		expect(flipped.flipX).toBe(true)
		expect(flipped.crop).toEqual({ x: 120, y: 10, width: 60, height: 30 })
	})

	it('mirrors annotation coordinates', () => {
		const state = stateWith({ annotations: [draw, box, text] })
		const flipped = flipHorizontal(state, ORIENTED)
		expect((flipped.annotations[0] as DrawAnnotation).points).toEqual([190, 20, 170, 40])
		expect((flipped.annotations[1] as BoxAnnotation).rect.x).toBe(160)
		expect((flipped.annotations[2] as TextAnnotation).x).toBe(150)
	})

	it('is its own inverse', () => {
		const state = stateWith({
			crop: { x: 20, y: 10, width: 60, height: 30 },
			annotations: [draw, arrow, box, text],
		})
		const twice = flipHorizontal(flipHorizontal(state, ORIENTED), ORIENTED)
		expect(twice).toEqual(state)
	})
})

describe('fine rotation and zoom', () => {
	it('defaults to no fine rotation and no zoom', () => {
		const state = createInitialState()
		expect(state.fineRotation).toBe(0)
		expect(state.zoom).toBe(1)
	})

	it('negates the fine rotation on flips', () => {
		const state = stateWith({ fineRotation: 15 })
		expect(flipHorizontal(state, ORIENTED).fineRotation).toBe(-15)
		expect(flipVertical(state, ORIENTED).fineRotation).toBe(-15)
	})

	it('keeps fine rotation and zoom across 90 degree turns', () => {
		const state = stateWith({ fineRotation: 15, zoom: 2 })
		const rotated = rotateCW(state, ORIENTED)
		expect(rotated.fineRotation).toBe(15)
		expect(rotated.zoom).toBe(2)
	})
})

describe('flip axis under rotation', () => {
	it('maps a visual horizontal flip to the source vertical axis when sideways', () => {
		const state = stateWith({ rotation: 90 })
		const flipped = flipHorizontal(state, { width: 100, height: 200 })
		expect(flipped.flipX).toBe(false)
		expect(flipped.flipY).toBe(true)
	})

	it('maps a visual vertical flip to the source horizontal axis when sideways', () => {
		const state = stateWith({ rotation: 270 })
		const flipped = flipVertical(state, { width: 100, height: 200 })
		expect(flipped.flipX).toBe(true)
		expect(flipped.flipY).toBe(false)
	})
})

describe('flipVertical', () => {
	it('toggles flipY and mirrors the crop', () => {
		const state = stateWith({ crop: { x: 20, y: 10, width: 60, height: 30 } })
		const flipped = flipVertical(state, ORIENTED)
		expect(flipped.flipY).toBe(true)
		expect(flipped.crop).toEqual({ x: 20, y: 60, width: 60, height: 30 })
	})

	it('is its own inverse', () => {
		const state = stateWith({
			crop: { x: 20, y: 10, width: 60, height: 30 },
			annotations: [draw, arrow, box, text],
		})
		const twice = flipVertical(flipVertical(state, ORIENTED), ORIENTED)
		expect(twice).toEqual(state)
	})
})

describe('translateAnnotation', () => {
	it('shifts points, rects and anchors', () => {
		expect((translateAnnotation(draw, 5, -5) as DrawAnnotation).points).toEqual([15, 15, 35, 35])
		expect((translateAnnotation(box, 5, -5) as BoxAnnotation).rect).toEqual({ x: 15, y: 15, width: 30, height: 40 })
		const moved = translateAnnotation(text, 5, -5) as TextAnnotation
		expect(moved.x).toBe(55)
		expect(moved.y).toBe(55)
	})
})

describe('duplicateAnnotation', () => {
	it('clones under a new id with an offset', () => {
		const copy = duplicateAnnotation(box)
		expect(copy.id).not.toBe(box.id)
		expect((copy as BoxAnnotation).rect.x).toBe(box.rect.x + 16)
		expect((copy as BoxAnnotation).rect.y).toBe(box.rect.y + 16)
	})
})
