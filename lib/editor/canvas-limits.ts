/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Size } from './state.ts'

/**
 * The smallest area the editor will settle for, and what a browser that
 * paints nothing at all is held to. Small enough that every device can
 * hold it, large enough to stay an image rather than a thumbnail.
 */
const FLOOR_AREA = 512 * 512

/**
 * How many times the search halves the gap once it has an area that
 * paints and one that does not. Each step allocates a canvas of about
 * the cap's size, so this trades a few probes for a result that lands
 * near the real cap rather than on a power of two.
 */
const REFINEMENTS = 4

/** The largest area seen to paint, and the smallest seen not to */
let largestGood = 0
let smallestBad = Number.POSITIVE_INFINITY

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
 * Whether an area paints, remembered as a pair of bounds so the same
 * ground is never probed twice.
 *
 * @param area the area to test, in pixels
 */
function fits(area: number): boolean {
	if (area <= largestGood) {
		return true
	}
	if (area >= smallestBad) {
		return false
	}
	if (paints(area)) {
		largestGood = area
		return true
	}
	smallestBad = area
	return false
}

/**
 * The factor a size has to be scaled by to fit the canvas cap, at most
 * 1. Anything below 1 means the editor cannot hold the image at its
 * natural resolution and the result will be smaller than the source.
 *
 * Only the area actually wanted is probed. Asking the browser for its
 * true ceiling instead means allocating and reading back canvases far
 * larger than the image: measured on a phone-class CPU, walking up to
 * 16384² cost 3.8 seconds of blocked main thread, of which 2.2 was the
 * last rung alone, and it ran while the loading spinner was on screen.
 *
 * @param size the size that wants allocating
 */
export function canvasScaleFor(size: Size): number {
	const area = size.width * size.height
	if (area <= 0 || fits(area)) {
		return 1
	}

	// Halve until something paints. A probe past the cap costs nothing
	// to speak of: the browser never allocates the backing store.
	let bad = area
	let good = 0
	for (let candidate = area / 2; candidate >= FLOOR_AREA; candidate /= 2) {
		if (fits(candidate)) {
			good = candidate
			break
		}
		bad = candidate
	}
	if (good === 0) {
		// A browser that will not paint even the floor is taken at its
		// word, so callers still get a bound the device can hold
		return Math.min(1, Math.sqrt(FLOOR_AREA / area))
	}

	for (let step = 0; step < REFINEMENTS; step++) {
		const middle = (good + bad) / 2
		if (fits(middle)) {
			good = middle
		} else {
			bad = middle
		}
	}
	return Math.min(1, Math.sqrt(good / area))
}

/**
 * Forget what has been probed. Test seam only.
 */
export function resetCanvasLimits(): void {
	largestGood = 0
	smallestBad = Number.POSITIVE_INFINITY
}
