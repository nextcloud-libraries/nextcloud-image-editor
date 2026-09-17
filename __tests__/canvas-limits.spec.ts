/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { canvasScaleFor, resetCanvasLimits } from '../lib/editor/canvas-limits.ts'

/** Every canvas area the code under test asked the browser for */
let probed: number[] = []

/**
 * Stand in for a browser that paints canvases up to `cap` pixels and
 * hands back a blank one past it, which is what they actually do.
 *
 * @param cap the largest area that paints
 */
function browserCappedAt(cap: number): void {
	probed = []
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function mock(this: HTMLCanvasElement) {
		// eslint-disable-next-line @typescript-eslint/no-this-alias -- the canvas under test is the receiver
		const canvas = this
		probed.push(canvas.width * canvas.height)
		return {
			fillRect: () => {},
			getImageData: () => ({
				data: [0, 0, 0, canvas.width * canvas.height <= cap ? 255 : 0],
			}),
			set fillStyle(_value: string) {},
		} as unknown as CanvasRenderingContext2D
	})
}

beforeEach(() => {
	resetCanvasLimits()
	vi.restoreAllMocks()
})

describe('canvasScaleFor', () => {
	it('leaves an image that already fits alone', () => {
		browserCappedAt(8192 * 8192)
		expect(canvasScaleFor({ width: 4000, height: 3000 })).toBe(1)
	})

	it('never probes a canvas larger than the image it was asked about', () => {
		browserCappedAt(16_384 * 16_384)
		const size = { width: 4000, height: 3000 }
		canvasScaleFor(size)

		// Walking up to the browser's own ceiling costs seconds of
		// blocked main thread on a phone, for an answer nobody needs:
		// the question is whether this image fits, not how far past it
		// the device could have gone
		expect(Math.max(...probed)).toBeLessThanOrEqual(size.width * size.height)
	})

	it('scales a larger image down to near the cap, keeping its shape', () => {
		const cap = 4096 * 4096
		browserCappedAt(cap)
		const size = { width: 12_000, height: 9000 }
		const scale = canvasScaleFor(size)

		const area = size.width * scale * size.height * scale
		expect(area).toBeLessThanOrEqual(cap)
		// Close enough to the cap that the image is not needlessly small
		expect(area).toBeGreaterThan(cap * 0.85)
	})

	it('takes a browser that paints nothing at its word', () => {
		browserCappedAt(0)
		const size = { width: 2048, height: 2048 }
		expect(canvasScaleFor(size)).toBeCloseTo(Math.sqrt((512 * 512) / (size.width * size.height)), 5)
	})

	it('measures a device more limited than iOS rather than assuming iOS', () => {
		const cap = 1024 * 1024
		browserCappedAt(cap)
		const size = { width: 4096, height: 4096 }
		const area = size.width * size.height * canvasScaleFor(size) ** 2

		expect(area).toBeLessThanOrEqual(cap)
		expect(area).toBeGreaterThan(cap * 0.85)
	})

	it('remembers what it probed rather than asking twice', () => {
		browserCappedAt(4096 * 4096)
		canvasScaleFor({ width: 4000, height: 3000 })
		const after = probed.length
		canvasScaleFor({ width: 4000, height: 3000 })
		expect(probed.length).toBe(after)
	})

	it('treats an empty size as needing no scaling', () => {
		browserCappedAt(4096 * 4096)
		expect(canvasScaleFor({ width: 0, height: 0 })).toBe(1)
	})
})
