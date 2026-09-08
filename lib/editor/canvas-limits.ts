/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Size } from './state.ts'

/**
 * Areas to probe, smallest first. The ladder starts well below any real
 * browser so that a device more limited than iOS is measured rather than
 * assumed, passes through the 4096² cap iOS and older Safari impose, and
 * ends above what desktop browsers allow. Probing stops at the first size
 * the browser will not paint, so nothing larger than the real cap is ever
 * allocated.
 */
const CANDIDATE_AREAS = [
	512 * 512,
	1024 * 1024,
	2048 * 2048,
	4096 * 4096,
	8192 * 8192,
	11_180 * 11_180,
	16_384 * 16_384,
]

/** Memoised result of {@link maxCanvasArea}. */
let probed: number | undefined

/**
 * Whether the browser paints a canvas of the given area, checked by
 * reading back the furthest pixel. Past the cap browsers hand out a
 * canvas that silently stays blank rather than throwing.
 *
 * @param area the area to test, in pixels
 */
function paints(area: number): boolean {
	const side = Math.floor(Math.sqrt(area))
	const canvas = document.createElement('canvas')
	canvas.width = side
	canvas.height = side
	const context = canvas.getContext('2d')
	if (context === null) {
		return false
	}
	try {
		context.fillStyle = '#ffffff'
		context.fillRect(side - 1, side - 1, 1, 1)
		return context.getImageData(side - 1, side - 1, 1, 1).data[3] === 255
	} catch {
		return false
	} finally {
		// Release the backing store rather than waiting for a collection
		canvas.width = 0
		canvas.height = 0
	}
}

/**
 * The largest canvas area this browser will actually paint, probed once
 * and remembered. A browser that will not paint even the smallest
 * candidate is taken at its word, so callers always get a bound the
 * device can actually hold.
 */
export function maxCanvasArea(): number {
	if (probed !== undefined) {
		return probed
	}
	probed = CANDIDATE_AREAS[0]!
	for (const area of CANDIDATE_AREAS) {
		if (!paints(area)) {
			break
		}
		probed = area
	}
	return probed
}

/**
 * The factor a size has to be scaled by to fit the canvas cap, at most
 * 1. Anything below 1 means the editor cannot hold the image at its
 * natural resolution and the result will be smaller than the source.
 *
 * @param size the size that wants allocating
 */
export function canvasScaleFor(size: Size): number {
	const area = size.width * size.height
	if (area <= 0) {
		return 1
	}
	return Math.min(1, Math.sqrt(maxCanvasArea() / area))
}

/**
 * Reset the memoised probe. Test seam only.
 */
export function resetCanvasLimits(): void {
	probed = undefined
}
