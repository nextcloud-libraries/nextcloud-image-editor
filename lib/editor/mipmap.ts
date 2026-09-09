/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Half-size copies of a source, built on demand and kept for as long
 * as the source is. Index 0 is half the source, 1 a quarter, and so on.
 */
const halves = new WeakMap<HTMLCanvasElement, HTMLCanvasElement[]>()

/**
 * Draw a canvas at half its size.
 *
 * @param source the canvas to shrink
 */
function halve(source: HTMLCanvasElement): HTMLCanvasElement {
	const canvas = document.createElement('canvas')
	canvas.width = Math.max(1, Math.ceil(source.width / 2))
	canvas.height = Math.max(1, Math.ceil(source.height / 2))
	const context = canvas.getContext('2d')
	if (context === null) {
		throw new Error('Canvas 2D context unavailable')
	}
	context.imageSmoothingQuality = 'high'
	context.drawImage(source, 0, 0, canvas.width, canvas.height)
	return canvas
}

/**
 * The copy of a source to draw when it is shown at the given scale.
 *
 * A canvas shrinking a picture by more than half reads a fraction of
 * its pixels and drops the rest, so a photo fitted five times smaller
 * than it is comes out speckled with whatever grain and detail happened
 * to land on the sampled pixels, where an `<img>` of the same photo is
 * smooth. Halving is the one shrink a canvas does well, since every
 * output pixel then averages the four under it, so the source is
 * halved as many times as fit and the remaining shrink is by less than
 * half. The copies are cached against the source, which is the same
 * canvas until the picture is rotated or flipped.
 *
 * @param source the oriented image
 * @param scale device pixels per source pixel
 */
export function levelFor(source: HTMLCanvasElement, scale: number): HTMLCanvasElement {
	let level = source
	let drawn = scale
	let depth = 0
	while (drawn <= 0.5 && level.width > 1 && level.height > 1) {
		const cached = halves.get(source) ?? []
		level = cached[depth] ?? halve(level)
		cached[depth] = level
		halves.set(source, cached)
		drawn *= 2
		depth += 1
	}
	return level
}
