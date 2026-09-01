/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { describe, expect, it } from 'vitest'
import { fitContain } from '../lib/utils/geometry.ts'

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
