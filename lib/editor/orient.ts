/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Rotation } from './state.ts'

import { orientedSize } from './state.ts'

/**
 * Bake rotation and mirroring into a canvas copy of the source image.
 * The result is the base every later editing step works on, which keeps
 * all downstream coordinates in one simple, unrotated space.
 *
 * @param image the decoded source image
 * @param rotation clockwise rotation to apply
 * @param flipX mirror horizontally
 * @param flipY mirror vertically
 */
export function orientImage(
	image: HTMLImageElement,
	rotation: Rotation,
	flipX: boolean,
	flipY: boolean,
): HTMLCanvasElement {
	const natural = { width: image.naturalWidth, height: image.naturalHeight }
	const oriented = orientedSize(natural, rotation)

	const canvas = document.createElement('canvas')
	canvas.width = oriented.width
	canvas.height = oriented.height

	const context = canvas.getContext('2d')
	if (context === null) {
		throw new Error('Canvas 2D context unavailable')
	}

	context.translate(oriented.width / 2, oriented.height / 2)
	context.rotate((rotation * Math.PI) / 180)
	context.scale(flipX ? -1 : 1, flipY ? -1 : 1)
	context.drawImage(image, -natural.width / 2, -natural.height / 2)

	return canvas
}
