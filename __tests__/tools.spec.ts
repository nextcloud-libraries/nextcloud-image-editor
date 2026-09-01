/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { ArrowAnnotation, BoxAnnotation, DrawAnnotation, EditorState, RedactAnnotation, TextAnnotation } from '../lib/editor/state.ts'
import type { PointerToolDeps } from '../lib/editor/tools.ts'

import { beforeAll, describe, expect, it } from 'vitest'
import { createInitialState } from '../lib/editor/state.ts'
import { attachPointerTools } from '../lib/editor/tools.ts'

beforeAll(() => {
	// Konva probes a 2D context when constructing shapes (hit-color
	// farbling detection); jsdom has no canvas, a stub suffices since
	// nothing is ever drawn in these tests
	HTMLCanvasElement.prototype.getContext = function getContext() {
		return {
			clearRect: () => {},
			fillRect: () => {},
			fillText: () => {},
			drawImage: () => {},
			save: () => {},
			restore: () => {},
			getImageData: () => ({ data: new Uint8ClampedArray(64) }),
		} as never
	} as never
})

interface Harness {
	deps: PointerToolDeps
	fire(event: 'pointerdown' | 'pointermove' | 'pointerup', point?: { x: number, y: number }): void
	committed(): EditorState | null
	textEdits: { x: number, y: number }[]
}

/**
 * A stage stub driving the pointer handlers without a canvas.
 */
function harness(): Harness {
	const handlers = new Map<string, () => void>()
	let pointer: { x: number, y: number } | null = null
	let lastCommit: EditorState | null = null
	const textEdits: { x: number, y: number }[] = []

	const deps: PointerToolDeps = {
		stage: {
			on: (names: string, handler: () => void) => {
				for (const name of names.split(' ')) {
					handlers.set(name.split('.')[0]!, handler)
				}
			},
			off: () => {},
			getPointerPosition: () => pointer,
		} as never,
		contentGroup: () => null,
		oriented: () => null,
		getState: () => lastCommit ?? createInitialState(),
		commit: (state) => {
			lastCommit = state
		},
		toScene: (point) => point,
		options: () => ({ color: '#123456', strokeWidth: 7, fontSize: 20, sticker: '🎈', redactStyle: 'blur' }),
		startTextEdit: (position) => {
			textEdits.push(position)
		},
	}

	return {
		deps,
		fire(event, point) {
			pointer = point ?? pointer
			handlers.get(event)?.()
		},
		committed: () => lastCommit,
		textEdits,
	}
}

describe('attachPointerTools', () => {
	it('collects freehand points across the drag', () => {
		const h = harness()
		attachPointerTools('draw', h.deps)
		h.fire('pointerdown', { x: 10, y: 10 })
		h.fire('pointermove', { x: 20, y: 15 })
		h.fire('pointermove', { x: 30, y: 20 })
		h.fire('pointerup')

		const annotation = h.committed()!.annotations[0] as DrawAnnotation
		expect(annotation.type).toBe('draw')
		expect(annotation.points).toEqual([10, 10, 20, 15, 30, 20])
		expect(annotation.color).toBe('#123456')
		expect(annotation.strokeWidth).toBe(7)
	})

	it('normalizes a reverse rectangle drag', () => {
		const h = harness()
		attachPointerTools('rectangle', h.deps)
		h.fire('pointerdown', { x: 50, y: 40 })
		h.fire('pointermove', { x: 10, y: 10 })
		h.fire('pointerup')

		const annotation = h.committed()!.annotations[0] as BoxAnnotation
		expect(annotation.rect).toEqual({ x: 10, y: 10, width: 40, height: 30 })
		expect(annotation.rotation).toBe(0)
	})

	it('keeps the arrow anchored at its start', () => {
		const h = harness()
		attachPointerTools('arrow', h.deps)
		h.fire('pointerdown', { x: 5, y: 5 })
		h.fire('pointermove', { x: 25, y: 10 })
		h.fire('pointermove', { x: 40, y: 30 })
		h.fire('pointerup')

		const annotation = h.committed()!.annotations[0] as ArrowAnnotation
		expect(annotation.points).toEqual([5, 5, 40, 30])
	})

	it('stamps redactions with the chosen style', () => {
		const h = harness()
		attachPointerTools('redact', h.deps)
		h.fire('pointerdown', { x: 0, y: 0 })
		h.fire('pointermove', { x: 30, y: 30 })
		h.fire('pointerup')

		const annotation = h.committed()!.annotations[0] as RedactAnnotation
		expect(annotation.type).toBe('redact')
		expect(annotation.style).toBe('blur')
	})

	it('defers text creation to pointerup so the overlay survives the click', () => {
		const h = harness()
		attachPointerTools('text', h.deps)
		h.fire('pointerdown', { x: 12, y: 34 })
		expect(h.textEdits).toHaveLength(0)
		h.fire('pointerup')
		expect(h.textEdits).toEqual([{ x: 12, y: 34 }])
		expect(h.committed()).toBeNull()
	})

	it('places a sticker immediately with doubled font size', () => {
		const h = harness()
		attachPointerTools('sticker', h.deps)
		h.fire('pointerdown', { x: 60, y: 70 })

		const annotation = h.committed()!.annotations[0] as TextAnnotation
		expect(annotation.type).toBe('sticker')
		expect(annotation.text).toBe('🎈')
		expect(annotation.fontSize).toBe(40)
		expect(annotation.x).toBe(60)
	})

	it('attaches nothing for non-drawing tools', () => {
		const h = harness()
		const detach = attachPointerTools('select', h.deps)
		h.fire('pointerdown', { x: 1, y: 1 })
		h.fire('pointerup')
		expect(h.committed()).toBeNull()
		detach()
	})
})
