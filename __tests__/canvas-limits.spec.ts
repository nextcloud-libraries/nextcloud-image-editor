/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { canvasScaleFor, maxCanvasArea, resetCanvasLimits } from '../lib/editor/canvas-limits.ts'

/**
 * Stand in for a browser that paints canvases up to `cap` pixels and
 * hands back a blank one past it, which is what they actually do.
 *
 * @param cap the largest area that paints
 */
function browserCappedAt(cap: number): void {
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function mock(this: HTMLCanvasElement) {
		// eslint-disable-next-line @typescript-eslint/no-this-alias -- the canvas under test is the receiver
		const canvas = this
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

describe('maxCanvasArea', () => {
	it('stops at the largest area the browser paints', () => {
		browserCappedAt(8192 * 8192)
		expect(maxCanvasArea()).toBe(8192 * 8192)
	})

	it('takes a browser that paints nothing at its word', () => {
		browserCappedAt(0)
		expect(maxCanvasArea()).toBe(512 * 512)
	})

	it('measures a device more limited than iOS rather than assuming iOS', () => {
		browserCappedAt(1024 * 1024)
		expect(maxCanvasArea()).toBe(1024 * 1024)
	})

	it('probes once and remembers the answer', () => {
		browserCappedAt(4096 * 4096)
		maxCanvasArea()
		const after = vi.mocked(HTMLCanvasElement.prototype.getContext).mock.calls.length
		maxCanvasArea()
		expect(vi.mocked(HTMLCanvasElement.prototype.getContext).mock.calls.length).toBe(after)
	})
})

describe('canvasScaleFor', () => {
	it('leaves an image that already fits alone', () => {
		browserCappedAt(8192 * 8192)
		expect(canvasScaleFor({ width: 4000, height: 3000 })).toBe(1)
	})

	it('scales a larger image down to the cap, keeping its shape', () => {
		browserCappedAt(4096 * 4096)
		const size = { width: 12_000, height: 9000 }
		const scale = canvasScaleFor(size)
		expect(scale).toBeLessThan(1)
		// The scaled area lands on the cap rather than under or over it
		expect(size.width * scale * size.height * scale).toBeCloseTo(4096 * 4096, 0)
	})

	it('treats an empty size as needing no scaling', () => {
		browserCappedAt(4096 * 4096)
		expect(canvasScaleFor({ width: 0, height: 0 })).toBe(1)
	})
})
