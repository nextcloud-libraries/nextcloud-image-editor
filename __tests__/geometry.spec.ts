/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { describe, expect, it } from 'vitest'
import { coverScale, fitContain, snapAngle } from '../lib/utils/geometry.ts'

describe('fitContain', () => {
	it('downscales to the limiting dimension', () => {
		const fit = fitContain({ width: 2000, height: 1000 }, { width: 1000, height: 1000 })
		expect(fit.scale).toBe(0.5)
		expect(fit.width).toBe(1000)
		expect(fit.height).toBe(500)
	})

	it('centers the content', () => {
		const fit = fitContain({ width: 2000, height: 1000 }, { width: 1000, height: 1000 })
		expect(fit.x).toBe(0)
		expect(fit.y).toBe(250)
	})

	it('never upscales small content', () => {
		const fit = fitContain({ width: 100, height: 50 }, { width: 1000, height: 1000 })
		expect(fit.scale).toBe(1)
		expect(fit.width).toBe(100)
		expect(fit.height).toBe(50)
		expect(fit.x).toBe(450)
		expect(fit.y).toBe(475)
	})

	it('handles portrait content in landscape container', () => {
		const fit = fitContain({ width: 1000, height: 4000 }, { width: 800, height: 400 })
		expect(fit.scale).toBe(0.1)
		expect(fit.width).toBe(100)
		expect(fit.height).toBe(400)
		expect(fit.x).toBe(350)
		expect(fit.y).toBe(0)
	})

	it('is exact when content equals container', () => {
		const fit = fitContain({ width: 640, height: 480 }, { width: 640, height: 480 })
		expect(fit).toEqual({ scale: 1, width: 640, height: 480, x: 0, y: 0 })
	})

	it('rejects non-positive dimensions', () => {
		expect(() => fitContain({ width: 0, height: 100 }, { width: 100, height: 100 })).toThrow(RangeError)
		expect(() => fitContain({ width: 100, height: 100 }, { width: 100, height: -1 })).toThrow(RangeError)
	})
})

describe('coverScale', () => {
	it('is 1 with no rotation', () => {
		expect(coverScale({ width: 200, height: 100 }, 0)).toBe(1)
	})

	it('is symmetric for opposite angles', () => {
		const box = { width: 200, height: 100 }
		expect(coverScale(box, 30)).toBeCloseTo(coverScale(box, -30), 10)
	})

	it('covers a square rotated 45 degrees with sqrt(2)', () => {
		expect(coverScale({ width: 100, height: 100 }, 45)).toBeCloseTo(Math.SQRT2, 10)
	})

	it('uses the limiting axis for landscape boxes', () => {
		// At 90 degrees the box swaps sides: the height must stretch to
		// the former width
		expect(coverScale({ width: 200, height: 100 }, 90)).toBeCloseTo(2, 10)
	})

	it('rejects non-positive dimensions', () => {
		expect(() => coverScale({ width: 0, height: 100 }, 10)).toThrow(RangeError)
	})
})

describe('snapAngle', () => {
	const from = { x: 10, y: 10 }

	it('lands exactly on the axes', () => {
		expect(snapAngle(from, { x: 50, y: 12 })).toEqual({ x: expect.closeTo(10 + Math.hypot(40, 2)), y: 10 })
		expect(snapAngle(from, { x: 8, y: -30 })).toEqual({ x: 10, y: expect.closeTo(10 - Math.hypot(2, 40)) })
	})

	it('keeps the length on a diagonal', () => {
		const snapped = snapAngle(from, { x: 40, y: 50 })
		expect(snapped.x - from.x).toBeCloseTo(snapped.y - from.y)
		expect(Math.hypot(snapped.x - from.x, snapped.y - from.y)).toBeCloseTo(50)
	})

	it('takes another step', () => {
		// 41° from the axis: a diagonal at 45° steps, flat at 90° ones
		const to = { x: 40, y: 36 }
		expect(snapAngle(from, to).x - from.x).toBeCloseTo(snapAngle(from, to).y - from.y)
		expect(snapAngle(from, to, Math.PI / 2)).toEqual({ x: expect.closeTo(10 + Math.hypot(30, 26)), y: 10 })
	})

	it('leaves a segment of no length where it is', () => {
		expect(snapAngle(from, from)).toEqual(from)
	})
})
