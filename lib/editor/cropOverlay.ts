/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Rect, Size } from './state.ts'

import Konva from 'konva'
import { clampRect } from './state.ts'

export interface CropOverlayDeps {
	stage: Konva.Stage
	/** Oriented image size in scene coordinates */
	oriented: Size
	/** View transform mapping scene to stage coordinates */
	scale: number
	offset: { x: number, y: number }
	/** Crop rect to start from, defaults to the full image */
	initial: Rect | null
}

export interface CropBox {
	x: number
	y: number
	width: number
	height: number
}

/**
 * Clamp a transformer bound box to the image so a resize keeps
 * following the cursor and only stops at the border. Under an aspect
 * lock the box keeps its ratio, anchored on the untouched edge.
 *
 * @param bounds the image bounds in stage coordinates
 * @param oldBox the box before this gesture step
 * @param newBox the requested box
 * @param keepRatio whether an aspect lock is active
 */
export function clampCropBox(bounds: CropBox, oldBox: CropBox, newBox: CropBox, keepRatio: boolean): CropBox {
	const right = bounds.x + bounds.width
	const bottom = bounds.y + bounds.height
	let { x, y, width, height } = newBox

	if (x < bounds.x) {
		width -= bounds.x - x
		x = bounds.x
	}
	if (y < bounds.y) {
		height -= bounds.y - y
		y = bounds.y
	}
	width = Math.min(width, right - x)
	height = Math.min(height, bottom - y)

	if (keepRatio && oldBox.height > 0) {
		const ratio = oldBox.width / oldBox.height
		if (width / height > ratio) {
			width = height * ratio
		} else {
			height = width / ratio
		}
		if (Math.abs(newBox.x - oldBox.x) > 0.01) {
			x = Math.min(newBox.x + newBox.width, right) - width
		}
		if (Math.abs(newBox.y - oldBox.y) > 0.01) {
			y = Math.min(newBox.y + newBox.height, bottom) - height
		}
	}

	return {
		...newBox,
		x,
		y,
		width: Math.max(8, width),
		height: Math.max(8, height),
	}
}

export interface CropOverlay {
	/** Current crop rectangle in scene coordinates */
	getRect(): Rect
	/**
	 * Lock the crop to an aspect ratio, resizing the current rect to
	 * match, or free it again with null.
	 *
	 * @param aspect width divided by height, or null for freeform
	 */
	setAspect(aspect: number | null): void
	destroy(): void
}

/**
 * Interactive crop overlay: a draggable, resizable rectangle with the
 * surrounding area dimmed. Works in stage coordinates on its own layer.
 *
 * @param deps stage, view transform and initial rect
 */
export function attachCropOverlay(deps: CropOverlayDeps): CropOverlay {
	const toStage = (rect: Rect): Rect => ({
		x: deps.offset.x + rect.x * deps.scale,
		y: deps.offset.y + rect.y * deps.scale,
		width: rect.width * deps.scale,
		height: rect.height * deps.scale,
	})
	const toScene = (rect: Rect): Rect => ({
		x: (rect.x - deps.offset.x) / deps.scale,
		y: (rect.y - deps.offset.y) / deps.scale,
		width: rect.width / deps.scale,
		height: rect.height / deps.scale,
	})

	const imageBounds = toStage({ x: 0, y: 0, ...deps.oriented })
	const layer = new Konva.Layer({ name: 'crop' })

	const makeShade = () => new Konva.Rect({
		fill: 'rgba(0, 0, 0, 0.5)',
		listening: false,
	})
	const shadeTop = makeShade()
	const shadeLeft = makeShade()
	const shadeRight = makeShade()
	const shadeBottom = makeShade()
	for (const shade of [shadeTop, shadeLeft, shadeRight, shadeBottom]) {
		layer.add(shade)
	}

	const cropNode = new Konva.Rect({
		...toStage(clampRect(deps.initial ?? { x: 0, y: 0, ...deps.oriented }, deps.oriented)),
		stroke: 'rgba(255, 255, 255, 0.9)',
		strokeWidth: 1,
		draggable: true,
		strokeScaleEnabled: false,
	})
	layer.add(cropNode)

	// Rule-of-thirds guides inside the crop rect
	const gridLines = Array.from({ length: 4 }, () => new Konva.Line({
		stroke: 'rgba(255, 255, 255, 0.35)',
		strokeWidth: 1,
		listening: false,
	}))
	for (const line of gridLines) {
		layer.add(line)
	}

	const clampToImage = (rect: Rect): Rect => {
		const x = Math.min(Math.max(rect.x, imageBounds.x), imageBounds.x + imageBounds.width - rect.width)
		const y = Math.min(Math.max(rect.y, imageBounds.y), imageBounds.y + imageBounds.height - rect.height)
		return { ...rect, x, y }
	}

	const updateOverlay = () => {
		const rect = {
			x: cropNode.x(),
			y: cropNode.y(),
			width: cropNode.width() * cropNode.scaleX(),
			height: cropNode.height() * cropNode.scaleY(),
		}
		const { x, y, width, height } = imageBounds
		shadeTop.setAttrs({ x, y, width, height: rect.y - y })
		shadeLeft.setAttrs({ x, y: rect.y, width: rect.x - x, height: rect.height })
		shadeRight.setAttrs({ x: rect.x + rect.width, y: rect.y, width: x + width - rect.x - rect.width, height: rect.height })
		shadeBottom.setAttrs({ x, y: rect.y + rect.height, width, height: y + height - rect.y - rect.height })

		// Thirds guides: two vertical, two horizontal
		gridLines[0]!.points([rect.x + rect.width / 3, rect.y, rect.x + rect.width / 3, rect.y + rect.height])
		gridLines[1]!.points([rect.x + (rect.width * 2) / 3, rect.y, rect.x + (rect.width * 2) / 3, rect.y + rect.height])
		gridLines[2]!.points([rect.x, rect.y + rect.height / 3, rect.x + rect.width, rect.y + rect.height / 3])
		gridLines[3]!.points([rect.x, rect.y + (rect.height * 2) / 3, rect.x + rect.width, rect.y + (rect.height * 2) / 3])
	}

	const transformer = new Konva.Transformer({
		nodes: [cropNode],
		rotateEnabled: false,
		flipEnabled: false,
		keepRatio: false,
		// Pintura-style solid round corner dots
		enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
		anchorSize: 14,
		anchorCornerRadius: 7,
		anchorFill: '#111',
		anchorStroke: '#111',
		anchorStrokeWidth: 1,
		borderStroke: 'rgba(255, 255, 255, 0.7)',
		boundBoxFunc: (oldBox, newBox) => ({ ...newBox, ...clampCropBox(imageBounds, oldBox, newBox, transformer.keepRatio()) }),

	})
	layer.add(transformer)

	cropNode.dragBoundFunc((position) => clampToImage({
		...position,
		width: cropNode.width() * cropNode.scaleX(),
		height: cropNode.height() * cropNode.scaleY(),
	}))
	cropNode.on('dragmove transform', updateOverlay)

	/**
	 * Resize the crop rect to the given ratio around its center, kept
	 * inside the image, and lock the transformer to it.
	 *
	 * @param aspect width divided by height, or null for freeform
	 */
	const setAspect = (aspect: number | null): void => {
		transformer.keepRatio(aspect !== null)
		if (aspect === null) {
			return
		}
		const current = {
			x: cropNode.x(),
			y: cropNode.y(),
			width: cropNode.width() * cropNode.scaleX(),
			height: cropNode.height() * cropNode.scaleY(),
		}
		// Largest rect with the wanted ratio that fits the image bounds,
		// no bigger than the current selection's longest edge
		const width = Math.min(
			Math.max(current.width, current.height * aspect),
			imageBounds.width,
			imageBounds.height * aspect,
		)
		const height = width / aspect
		const center = { x: current.x + current.width / 2, y: current.y + current.height / 2 }
		const position = clampToImage({
			x: center.x - width / 2,
			y: center.y - height / 2,
			width,
			height,
		})
		cropNode.setAttrs({ ...position, width, height, scaleX: 1, scaleY: 1 })
		transformer.forceUpdate()
		updateOverlay()
	}

	updateOverlay()
	deps.stage.add(layer)

	return {
		setAspect,
		getRect() {
			const scene = toScene({
				x: cropNode.x(),
				y: cropNode.y(),
				width: cropNode.width() * cropNode.scaleX(),
				height: cropNode.height() * cropNode.scaleY(),
			})
			return clampRect({
				x: Math.round(scene.x),
				y: Math.round(scene.y),
				width: Math.round(scene.width),
				height: Math.round(scene.height),
			}, deps.oriented)
		},
		destroy() {
			transformer.destroy()
			layer.destroy()
		},
	}
}
