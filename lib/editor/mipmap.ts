/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { imageWorker } from '../utils/image-worker.ts'

/** A copy the scene can draw: either kind carries its own size */
export type ImageLevel = HTMLCanvasElement | ImageBitmap

/**
 * Half-size copies of a source, kept for as long as the source is.
 * Index 0 is half the source, 1 a quarter, and so on.
 */
const halves = new WeakMap<HTMLCanvasElement, ImageLevel[]>()

/**
 * How many levels are built ahead of the first frame. Four covers a
 * photo shown down to a sixteenth of its size, which is past what any
 * viewport asks of one.
 */
const PREBUILT_LEVELS = 4

/**
 * Draw a level at half its size.
 *
 * @param source the level to shrink
 */
function halve(source: ImageLevel): HTMLCanvasElement {
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
 * Build the levels for a source in a worker, before anything asks for
 * them.
 *
 * Halving a 12 Mpx photo three times costs about 400ms of blocked main
 * thread on a phone-class CPU, and it lands on the first frame after an
 * image is opened, where the editor has nothing to show but a spinner
 * that cannot turn while the thread is held. In a worker the same work
 * costs the main thread nothing worth measuring.
 *
 * Resolves whether or not it worked: a browser with no worker to give
 * still gets its levels, one at a time, from {@link levelFor}.
 *
 * @param source the oriented image
 */
export async function prepareLevels(source: HTMLCanvasElement): Promise<void> {
	const worker = imageWorker()
	if (worker === null || halves.has(source)) {
		return
	}
	try {
		const bitmap = await createImageBitmap(source)
		const levels = await worker.levels(bitmap, PREBUILT_LEVELS)
		// A rotation may have replaced the source while the worker ran,
		// and the cache is keyed by the canvas it was built from
		halves.set(source, levels)
	} catch {
		// Falling back costs time, not correctness
	}
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
export function levelFor(source: HTMLCanvasElement, scale: number): ImageLevel {
	let level: ImageLevel = source
	let drawn = scale
	let depth = 0
	while (drawn <= 0.5 && (level.width > 1 || level.height > 1)) {
		const cached = halves.get(source) ?? []
		level = cached[depth] ?? halve(level)
		cached[depth] = level
		halves.set(source, cached)
		drawn *= 2
		depth += 1
	}
	return level
}
