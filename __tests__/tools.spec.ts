/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { ArrowAnnotation, BoxAnnotation, DrawAnnotation, EditorState, RedactAnnotation, TextAnnotation } from '../lib/editor/state.ts'
import type { PointerToolDeps } from '../lib/editor/tools.ts'

import { afterEach, beforeAll, describe, expect, it } from 'vitest'
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

/** Tools attached by the current test, detached again afterwards */
const attachments: (() => void)[] = []

/**
 * Attach a tool and remember how to detach it. The tools listen on the
 * window for a release, so a leaked attachment would answer another
 * test's events.
 *
 * @param tool the tool to attach
 * @param deps the harness dependencies
 */
function attach(tool: Parameters<typeof attachPointerTools>[0], deps: PointerToolDeps): () => void {
	const detach = attachPointerTools(tool, deps)
	attachments.push(detach)
	return detach
}

afterEach(() => {
	while (attachments.length > 0) {
		attachments.pop()!()
	}
})

interface Harness {
	deps: PointerToolDeps
	fire(event: 'pointerdown' | 'pointermove' | 'pointerup', point?: { x: number, y: number }): void
	committed(): EditorState | null
	textEdits: { x: number, y: number }[]
	/** Simulate a view pan taking over the pointer */
	setPanning(panning: boolean): void
}

/**
 * A stage stub driving the pointer handlers without a canvas.
 */
function harness(): Harness {
	const handlers = new Map<string, () => void>()
	let pointer: { x: number, y: number } | null = null
	let lastCommit: EditorState | null = null
	const textEdits: { x: number, y: number }[] = []
	let panning = false

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
		panning: () => panning,
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
		setPanning(next) {
			panning = next
		},
	}
}

describe('attachPointerTools', () => {
	it('collects freehand points across the drag', () => {
		const h = harness()
		attach('draw', h.deps)
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
		attach('rectangle', h.deps)
		h.fire('pointerdown', { x: 50, y: 40 })
		h.fire('pointermove', { x: 10, y: 10 })
		h.fire('pointerup')

		const annotation = h.committed()!.annotations[0] as BoxAnnotation
		expect(annotation.rect).toEqual({ x: 10, y: 10, width: 40, height: 30 })
		expect(annotation.rotation).toBe(0)
	})

	it('keeps the arrow anchored at its start', () => {
		const h = harness()
		attach('arrow', h.deps)
		h.fire('pointerdown', { x: 5, y: 5 })
		h.fire('pointermove', { x: 25, y: 10 })
		h.fire('pointermove', { x: 40, y: 30 })
		h.fire('pointerup')

		const annotation = h.committed()!.annotations[0] as ArrowAnnotation
		expect(annotation.points).toEqual([5, 5, 40, 30])
	})

	it('stamps redactions with the chosen style', () => {
		const h = harness()
		attach('redact', h.deps)
		h.fire('pointerdown', { x: 0, y: 0 })
		h.fire('pointermove', { x: 30, y: 30 })
		h.fire('pointerup')

		const annotation = h.committed()!.annotations[0] as RedactAnnotation
		expect(annotation.type).toBe('redact')
		expect(annotation.style).toBe('blur')
	})

	it('defers text creation to pointerup so the overlay survives the click', () => {
		const h = harness()
		attach('text', h.deps)
		h.fire('pointerdown', { x: 12, y: 34 })
		expect(h.textEdits).toHaveLength(0)
		h.fire('pointerup')
		expect(h.textEdits).toEqual([{ x: 12, y: 34 }])
		expect(h.committed()).toBeNull()
	})

	it('places a sticker immediately with doubled font size', () => {
		const h = harness()
		attach('sticker', h.deps)
		h.fire('pointerdown', { x: 60, y: 70 })

		const annotation = h.committed()!.annotations[0] as TextAnnotation
		expect(annotation.type).toBe('sticker')
		expect(annotation.text).toBe('🎈')
		expect(annotation.fontSize).toBe(40)
		expect(annotation.x).toBe(60)
	})

	it('attaches nothing for non-drawing tools', () => {
		const h = harness()
		const detach = attach('select', h.deps)
		h.fire('pointerdown', { x: 1, y: 1 })
		h.fire('pointerup')
		expect(h.committed()).toBeNull()
		detach()
	})

	it('ignores a press while the view is being panned', () => {
		const stage = harness()
		stage.setPanning(true)
		attach('draw', stage.deps)

		stage.fire('pointerdown', { x: 5, y: 5 })
		stage.fire('pointermove', { x: 20, y: 20 })
		stage.fire('pointerup')

		expect(stage.committed()).toBeNull()
	})

	it('drops the stroke in progress when a pan takes over', () => {
		const stage = harness()
		attach('draw', stage.deps)

		stage.fire('pointerdown', { x: 5, y: 5 })
		stage.fire('pointermove', { x: 12, y: 12 })
		// A second finger landing turns the gesture into a pinch
		stage.setPanning(true)
		stage.fire('pointermove', { x: 30, y: 30 })
		stage.fire('pointerup')

		expect(stage.committed()).toBeNull()
	})

	it('does not place a sticker while the view is being panned', () => {
		const stage = harness()
		stage.setPanning(true)
		attach('sticker', stage.deps)

		stage.fire('pointerdown', { x: 40, y: 40 })

		expect(stage.committed()).toBeNull()
	})

	it('commits a stroke released outside the canvas', () => {
		const stage = harness()
		attach('draw', stage.deps)

		stage.fire('pointerdown', { x: 5, y: 5 })
		stage.fire('pointermove', { x: 20, y: 20 })
		// The release lands on a panel, so Konva never hears about it
		window.dispatchEvent(new Event('pointerup'))

		expect(stage.committed()?.annotations).toHaveLength(1)
	})

	it('drops the stroke when the gesture is cancelled', () => {
		const stage = harness()
		attach('draw', stage.deps)

		stage.fire('pointerdown', { x: 5, y: 5 })
		stage.fire('pointermove', { x: 20, y: 20 })
		window.dispatchEvent(new Event('pointercancel'))
		window.dispatchEvent(new Event('pointerup'))

		expect(stage.committed()).toBeNull()
	})

	it('commits once when the release reaches both the stage and the window', () => {
		const stage = harness()
		attach('draw', stage.deps)

		stage.fire('pointerdown', { x: 5, y: 5 })
		stage.fire('pointermove', { x: 20, y: 20 })
		stage.fire('pointerup')
		const committed = stage.committed()
		window.dispatchEvent(new Event('pointerup'))

		expect(stage.committed()).toBe(committed)
		expect(committed?.annotations).toHaveLength(1)
	})
})
