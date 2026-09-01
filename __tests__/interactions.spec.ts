/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { ArrowAnnotation, BoxAnnotation, DrawAnnotation, RedactAnnotation, TextAnnotation } from '../lib/editor/state.ts'

import { describe, expect, it } from 'vitest'
import { clampCropBox } from '../lib/editor/cropOverlay.ts'
import { applyNodeTransform } from '../lib/editor/selection.ts'

const BOUNDS = { x: 100, y: 50, width: 400, height: 200 }

/**
 * A fake Konva node exposing only the getters the fold reads.
 *
 * @param values transform values reported by the node
 */
function fakeNode(values: { x?: number, y?: number, scaleX?: number, scaleY?: number, rotation?: number }) {
	return {
		x: () => values.x ?? 0,
		y: () => values.y ?? 0,
		scaleX: () => values.scaleX ?? 1,
		scaleY: () => values.scaleY ?? 1,
		rotation: () => values.rotation ?? 0,
	}
}

describe('clampCropBox', () => {
	const inside = { x: 150, y: 80, width: 100, height: 60 }

	it('keeps boxes fully inside the bounds untouched', () => {
		expect(clampCropBox(BOUNDS, inside, inside, false)).toEqual(inside)
	})

	it('clamps the leading edges while following the cursor', () => {
		const requested = { x: 60, y: 20, width: 200, height: 120 }
		const clamped = clampCropBox(BOUNDS, inside, requested, false)
		// The left/top overshoot is eaten by the box, not the gesture
		expect(clamped.x).toBe(100)
		expect(clamped.y).toBe(50)
		expect(clamped.width).toBe(160)
		expect(clamped.height).toBe(90)
	})

	it('clamps the trailing edges to the bounds', () => {
		const requested = { x: 450, y: 200, width: 300, height: 300 }
		const clamped = clampCropBox(BOUNDS, inside, requested, false)
		expect(clamped.x + clamped.width).toBeLessThanOrEqual(500)
		expect(clamped.y + clamped.height).toBeLessThanOrEqual(250)
	})

	it('never collapses below the minimum size', () => {
		const requested = { x: 490, y: 240, width: 2, height: 2 }
		const clamped = clampCropBox(BOUNDS, inside, requested, false)
		expect(clamped.width).toBe(8)
		expect(clamped.height).toBe(8)
	})

	it('keeps the locked ratio when a clamp shortens one side', () => {
		const old = { x: 150, y: 80, width: 100, height: 50 }
		const requested = { x: 40, y: 80, width: 210, height: 105 }
		const clamped = clampCropBox(BOUNDS, old, requested, true)
		expect(clamped.width / clamped.height).toBeCloseTo(2, 5)
		// The dragged left edge re-anchors on the fixed right edge
		expect(clamped.x + clamped.width).toBeCloseTo(Math.min(250, 500), 5)
	})
})

describe('applyNodeTransform', () => {
	it('translates freehand and arrow points by the node offset', () => {
		const draw: DrawAnnotation = { id: 'd', type: 'draw', points: [10, 20, 30, 40], color: '#f00', strokeWidth: 4 }
		const moved = applyNodeTransform(draw, fakeNode({ x: 5, y: -5 })) as DrawAnnotation
		expect(moved.points).toEqual([15, 15, 35, 35])

		const arrow: ArrowAnnotation = { id: 'a', type: 'arrow', points: [0, 0, 10, 10], color: '#f00', strokeWidth: 4 }
		const movedArrow = applyNodeTransform(arrow, fakeNode({ x: 1, y: 2 })) as ArrowAnnotation
		expect(movedArrow.points).toEqual([1, 2, 11, 12])
	})

	it('folds position, scale and rotation into boxes', () => {
		const box: BoxAnnotation = { id: 'b', type: 'rectangle', rect: { x: 0, y: 0, width: 40, height: 20 }, rotation: 0, color: '#f00', strokeWidth: 4 }
		const folded = applyNodeTransform(box, fakeNode({ x: 7, y: 9, scaleX: 2, scaleY: 3, rotation: 15 })) as BoxAnnotation
		expect(folded.rect).toEqual({ x: 7, y: 9, width: 80, height: 60 })
		expect(folded.rotation).toBe(15)
	})

	it('keeps redactions axis aligned', () => {
		const redact: RedactAnnotation = { id: 'r', type: 'redact', rect: { x: 5, y: 5, width: 30, height: 30 }, style: 'pixelate' }
		const folded = applyNodeTransform(redact, fakeNode({ x: 10, y: 10, scaleX: 2, scaleY: 2, rotation: 45 })) as RedactAnnotation
		expect(folded.rect).toEqual({ x: 10, y: 10, width: 60, height: 60 })
		expect('rotation' in folded).toBe(false)
	})

	it('scales the font with the node for text', () => {
		const text: TextAnnotation = { id: 't', type: 'text', x: 0, y: 0, text: 'hi', color: '#f00', fontSize: 20, rotation: 0 }
		const folded = applyNodeTransform(text, fakeNode({ x: 3, y: 4, scaleY: 1.5, rotation: 30 })) as TextAnnotation
		expect(folded.fontSize).toBe(30)
		expect(folded.rotation).toBe(30)
		expect(folded.x).toBe(3)
	})

	it('enforces minimum sizes', () => {
		const box: BoxAnnotation = { id: 'b', type: 'ellipse', rect: { x: 0, y: 0, width: 40, height: 20 }, rotation: 0, color: '#f00', strokeWidth: 4 }
		const folded = applyNodeTransform(box, fakeNode({ scaleX: 0.001, scaleY: 0.001 })) as BoxAnnotation
		expect(folded.rect.width).toBeGreaterThanOrEqual(1)
		expect(folded.rect.height).toBeGreaterThanOrEqual(1)
	})
})
