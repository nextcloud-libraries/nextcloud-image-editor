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
