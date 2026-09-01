/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { EditorState } from './state.ts'

import { coverScale } from '../utils/geometry.ts'
import { orientedSize } from './state.ts'

/**
 * Bake orientation, fine rotation and zoom into a canvas copy of the
 * source image. The canvas always keeps the 90°-oriented dimensions:
 * fine rotation and zoom scale the content up to cover the full frame,
 * so every downstream coordinate lives in one stable, unrotated space.
 *
 * @param image the decoded source image
 * @param state the orientation-affecting parts of the edit state
 */
export function orientImage(
	image: HTMLImageElement,
	state: Pick<EditorState, 'rotation' | 'flipX' | 'flipY' | 'fineRotation' | 'zoom'>,
): HTMLCanvasElement {
	const natural = { width: image.naturalWidth, height: image.naturalHeight }
	const oriented = orientedSize(natural, state.rotation)

	const canvas = document.createElement('canvas')
	canvas.width = oriented.width
	canvas.height = oriented.height

	const context = canvas.getContext('2d')
	if (context === null) {
		throw new Error('Canvas 2D context unavailable')
	}

	const cover = coverScale(oriented, state.fineRotation) * Math.max(1, state.zoom)

	context.translate(oriented.width / 2, oriented.height / 2)
	context.rotate((state.fineRotation * Math.PI) / 180)
	context.scale(cover, cover)
	context.rotate((state.rotation * Math.PI) / 180)
	context.scale(state.flipX ? -1 : 1, state.flipY ? -1 : 1)
	context.drawImage(image, -natural.width / 2, -natural.height / 2)

	return canvas
}
