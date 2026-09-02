/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { describe, expect, it } from 'vitest'
import { supportsContextFilter, thumbnailKey } from '../lib/editor/render.ts'
import { createInitialState } from '../lib/editor/state.ts'

/** A context that honors the filter property, like Chrome or Firefox */
function honoringContext(): Pick<CanvasRenderingContext2D, 'filter'> {
	return { filter: 'none' }
}

/** A context that ignores writes, like WebKit before Safari 18 */
function ignoringContext(): Pick<CanvasRenderingContext2D, 'filter'> {
	return {
		get filter() {
			return 'none'
		},
		set filter(_value: string) {
			// Dropped on the floor, exactly as the unsupporting engines do
		},
	}
}

describe('supportsContextFilter', () => {
	it('detects support when the assignment sticks', () => {
		expect(supportsContextFilter(honoringContext())).toBe(true)
	})

	it('detects the absence of support when the assignment is ignored', () => {
		expect(supportsContextFilter(ignoringContext())).toBe(false)
	})

	it('reports no support without a context at all', () => {
		expect(supportsContextFilter(null)).toBe(false)
	})
})

describe('thumbnailKey', () => {
	it('changes when the visible area changes', () => {
		const state = createInitialState()
		const cropped = { ...state, crop: { x: 10, y: 10, width: 100, height: 80 } }
		expect(thumbnailKey(cropped)).not.toBe(thumbnailKey(state))
	})

	it('changes when an adjustment changes', () => {
		const state = createInitialState()
		const brighter = { ...state, adjustments: { ...state.adjustments, brightness: 20 } }
		expect(thumbnailKey(brighter)).not.toBe(thumbnailKey(state))
	})

	it('is unchanged by the active preset', () => {
		const state = createInitialState()
		expect(thumbnailKey({ ...state, preset: 'noir' })).toBe(thumbnailKey(state))
	})

	it('is unchanged by annotations', () => {
		const state = createInitialState()
		const annotated = {
			...state,
			annotations: [{
				id: 'a',
				type: 'draw' as const,
				points: [0, 0, 1, 1],
				color: '#fff',
				strokeWidth: 2,
			}],
		}
		expect(thumbnailKey(annotated)).toBe(thumbnailKey(state))
	})
})
