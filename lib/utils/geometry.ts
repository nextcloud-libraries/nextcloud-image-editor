/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export interface Box {
	width: number
	height: number
}

export interface FitResult {
	/** Applied uniform scale factor */
	scale: number
	/** Scaled content width */
	width: number
	/** Scaled content height */
	height: number
	/** Horizontal offset centering the content in the container */
	x: number
	/** Vertical offset centering the content in the container */
	y: number
}

/**
 * Scale content to fit inside a container, preserving aspect ratio.
 * Content is centered and never upscaled beyond its natural size.
 *
 * @param content natural content dimensions
 * @param container available container dimensions
 */
/**
 * Scale factor needed so a box rotated by the given angle still fully
 * covers its own unrotated bounds (no exposed corners).
 *
 * @param box the box dimensions
 * @param degrees rotation angle in degrees
 */
export function coverScale(box: Box, degrees: number): number {
	if (box.width <= 0 || box.height <= 0) {
		throw new RangeError('Dimensions must be positive')
	}
	const radians = (degrees * Math.PI) / 180
	const cos = Math.abs(Math.cos(radians))
	const sin = Math.abs(Math.sin(radians))
	return Math.max(
		(box.width * cos + box.height * sin) / box.width,
		(box.width * sin + box.height * cos) / box.height,
	)
}

/**
 * Scale content to fit inside a container, preserving aspect ratio.
 * Content is centered and never upscaled beyond its natural size.
 *
 * @param content natural content dimensions
 * @param container available container dimensions
 */
export function fitContain(content: Box, container: Box): FitResult {
	if (content.width <= 0 || content.height <= 0
		|| container.width <= 0 || container.height <= 0) {
		throw new RangeError('Dimensions must be positive')
	}

	const scale = Math.min(
		container.width / content.width,
		container.height / content.height,
		1,
	)
	const width = content.width * scale
	const height = content.height * scale

	return {
		scale,
		width,
		height,
		x: (container.width - width) / 2,
		y: (container.height - height) / 2,
	}
}

export interface Point {
	x: number
	y: number
}

/**
 * Move the end of a segment onto the nearest multiple of the given
 * angle, keeping its length. Horizontal and vertical ends land exactly.
 *
 * @param from where the segment starts
 * @param to where the pointer is
 * @param step the angle to snap to, in radians
 */
export function snapAngle(from: Point, to: Point, step = Math.PI / 4): Point {
	const dx = to.x - from.x
	const dy = to.y - from.y
	if (dx === 0 && dy === 0) {
		return to
	}
	const length = Math.hypot(dx, dy)
	const angle = Math.round(Math.atan2(dy, dx) / step) * step
	// cos and sin of a right angle are not exactly 0, and a line drawn
	// straight should be straight
	const round = (value: number) => (Math.abs(value) < 1e-9 ? 0 : value)
	return {
		x: from.x + length * round(Math.cos(angle)),
		y: from.y + length * round(Math.sin(angle)),
	}
}
