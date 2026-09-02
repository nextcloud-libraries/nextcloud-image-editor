/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { describe, expect, it } from 'vitest'
import { anchoredPan, clampPan, clampZoom, MAX_ZOOM, MIN_ZOOM, panBounds, VIEW_MARGIN, wheelZoomFactor } from '../lib/editor/view.ts'

describe('panBounds', () => {
	it('pins the view while the content fits the container', () => {
		const bounds = panBounds({ width: 200, height: 100 }, 1, { width: 800, height: 600 })
		expect(bounds).toEqual({ x: 0, y: 0 })
	})

	it('allows half the overflow plus the stage margin', () => {
		const bounds = panBounds({ width: 1000, height: 1000 }, 2, { width: 500, height: 500 })
		expect(bounds).toEqual({ x: 750 + VIEW_MARGIN, y: 750 + VIEW_MARGIN })
	})

	it('grows with the zoom', () => {
		const visible = { width: 400, height: 400 }
		const container = { width: 500, height: 500 }
		expect(panBounds(visible, 4, container).x).toBeGreaterThan(panBounds(visible, 2, container).x)
	})
})

describe('clampPan', () => {
	it('passes an offset inside the bounds through', () => {
		expect(clampPan({ x: 10, y: -20 }, { x: 100, y: 100 })).toEqual({ x: 10, y: -20 })
	})

	it('holds an overshooting offset at the bound instead of storing it', () => {
		expect(clampPan({ x: 5000, y: -5000 }, { x: 120, y: 80 })).toEqual({ x: 120, y: -80 })
	})

	it('collapses to zero where no panning is possible', () => {
		expect(clampPan({ x: 42, y: 42 }, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 })
	})
})

describe('clampZoom', () => {
	it('snaps a near-fitted zoom back to the fitted view', () => {
		expect(clampZoom(1.04)).toBe(MIN_ZOOM)
		expect(clampZoom(0.2)).toBe(MIN_ZOOM)
	})

	it('keeps a zoom inside the range', () => {
		expect(clampZoom(2)).toBe(2)
		expect(clampZoom(99)).toBe(MAX_ZOOM)
	})
})

describe('anchoredPan', () => {
	it('keeps the point under the cursor fixed', () => {
		// A cursor already at the pan offset describes the point the view
		// is centered on, which must not move whatever the factor is
		expect(anchoredPan({ x: 30, y: 30 }, { x: 30, y: 30 }, 2)).toEqual({ x: 30, y: 30 })
	})

	it('pushes the offset away from the cursor when zooming in', () => {
		expect(anchoredPan({ x: 0, y: 0 }, { x: 100, y: 50 }, 2)).toEqual({ x: -100, y: -50 })
	})

	it('is reversible by the inverse factor', () => {
		const zoomedIn = anchoredPan({ x: 12, y: -4 }, { x: 60, y: 20 }, 2)
		expect(anchoredPan(zoomedIn, { x: 60, y: 20 }, 0.5)).toEqual({ x: 12, y: -4 })
	})
})

describe('wheelZoomFactor', () => {
	it('zooms in on negative travel and out on positive travel', () => {
		expect(wheelZoomFactor(-100, 0, 800)).toBeGreaterThan(1)
		expect(wheelZoomFactor(100, 0, 800)).toBeLessThan(1)
	})

	it('cancels out over opposite travel of the same size', () => {
		expect(wheelZoomFactor(-120, 0, 800) * wheelZoomFactor(120, 0, 800)).toBeCloseTo(1, 10)
	})

	it('follows the travel instead of stepping by a fixed amount', () => {
		expect(wheelZoomFactor(-200, 0, 800)).toBeGreaterThan(wheelZoomFactor(-100, 0, 800))
	})

	it('normalizes line deltas so both engines feel alike', () => {
		// Three lines is one Firefox notch, worth about 48 pixels
		expect(wheelZoomFactor(-3, 1, 800)).toBeCloseTo(wheelZoomFactor(-48, 0, 800), 10)
	})

	it('normalizes page deltas against the viewport', () => {
		expect(wheelZoomFactor(-1, 2, 600)).toBeCloseTo(wheelZoomFactor(-600, 0, 600), 10)
	})

	it('bounds a single flick so it cannot cross the zoom range', () => {
		expect(wheelZoomFactor(-100000, 0, 800)).toBe(wheelZoomFactor(-300, 0, 800))
		expect(wheelZoomFactor(-100000, 0, 800)).toBeLessThan(MAX_ZOOM)
	})
})
