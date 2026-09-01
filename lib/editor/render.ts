/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Annotation, EditorState, Size } from './state.ts'

import Konva from 'konva'

/**
 * The part of the oriented image currently visible: the crop, or all of it.
 *
 * @param state the edit state
 * @param oriented the oriented image size
 */
export function visibleRect(state: EditorState, oriented: Size) {
	return state.crop ?? { x: 0, y: 0, ...oriented }
}

/**
 * Build the Konva node for one annotation. Nodes carry the annotation id
 * and the 'annotation' name so tools can map them back to state entries.
 *
 * @param annotation the annotation to render
 */
export function buildAnnotationNode(annotation: Annotation): Konva.Shape {
	const base = { id: annotation.id, name: 'annotation' }
	switch (annotation.type) {
		case 'draw':
			return new Konva.Line({
				...base,
				points: annotation.points,
				stroke: annotation.color,
				strokeWidth: annotation.strokeWidth,
				lineCap: 'round',
				lineJoin: 'round',
			})
		case 'arrow':
			return new Konva.Arrow({
				...base,
				points: [...annotation.points],
				stroke: annotation.color,
				fill: annotation.color,
				strokeWidth: annotation.strokeWidth,
				pointerLength: annotation.strokeWidth * 4,
				pointerWidth: annotation.strokeWidth * 4,
			})
		case 'rectangle':
			return new Konva.Rect({
				...base,
				...annotation.rect,
				stroke: annotation.color,
				strokeWidth: annotation.strokeWidth,
			})
		case 'ellipse':
			return new Konva.Ellipse({
				...base,
				x: annotation.rect.x + annotation.rect.width / 2,
				y: annotation.rect.y + annotation.rect.height / 2,
				radiusX: annotation.rect.width / 2,
				radiusY: annotation.rect.height / 2,
				stroke: annotation.color,
				strokeWidth: annotation.strokeWidth,
			})
		case 'text':
		case 'sticker':
			return new Konva.Text({
				...base,
				x: annotation.x,
				y: annotation.y,
				text: annotation.text,
				fill: annotation.color,
				fontSize: annotation.fontSize,
				rotation: annotation.rotation,
			})
	}
}

/**
 * Apply adjustments and the filter preset to the image node.
 * Konva filters require the node to be cached; the cache is dropped
 * again when no filter is active.
 *
 * @param node the Konva image node
 * @param state the edit state
 */
export function applyFilters(node: Konva.Image, state: EditorState): void {
	const { brightness, contrast, saturation } = state.adjustments
	const filters = []

	if (brightness !== 0) {
		filters.push(Konva.Filters.Brighten)
	}
	if (contrast !== 0) {
		filters.push(Konva.Filters.Contrast)
	}
	if (saturation !== 0) {
		filters.push(Konva.Filters.HSL)
	}
	if (state.preset === 'grayscale') {
		filters.push(Konva.Filters.Grayscale)
	} else if (state.preset === 'sepia') {
		filters.push(Konva.Filters.Sepia)
	}

	if (filters.length === 0) {
		node.filters([])
		node.clearCache()
		return
	}

	node.filters(filters)
	node.brightness(brightness / 100)
	node.contrast(contrast)
	node.saturation(saturation / 100)
	node.cache({ pixelRatio: 1 })
}

export interface SceneOptions {
	/** Uniform view scale applied to the content */
	scale: number
	/** Stage-space position of the visible area's top-left corner */
	offset: { x: number, y: number }
	/** Clip to the crop rect; disabled while the crop tool shows context */
	showCropped: boolean
}

export interface Scene {
	contentGroup: Konva.Group
	imageNode: Konva.Image
	annotationNodes: Konva.Shape[]
}

/**
 * Rebuild the stage content from the edit state. One code path renders
 * both the interactive view and the export, keeping them identical.
 *
 * @param stage the target stage, cleared before building
 * @param oriented the orientation-baked source canvas
 * @param state the edit state
 * @param options view transform and crop behavior
 */
export function renderScene(
	stage: Konva.Stage,
	oriented: HTMLCanvasElement,
	state: EditorState,
	options: SceneOptions,
): Scene {
	stage.destroyChildren()

	// While the crop tool shows the full image for context, the view
	// origin is the image corner instead of the crop corner
	const origin = options.showCropped
		? visibleRect(state, { width: oriented.width, height: oriented.height })
		: { x: 0, y: 0 }
	const contentGroup = new Konva.Group({
		x: options.offset.x - origin.x * options.scale,
		y: options.offset.y - origin.y * options.scale,
		scaleX: options.scale,
		scaleY: options.scale,
	})
	if (options.showCropped && state.crop !== null) {
		contentGroup.clip(state.crop)
	}

	const imageNode = new Konva.Image({ image: oriented, listening: false })
	applyFilters(imageNode, state)
	contentGroup.add(imageNode)

	const annotationNodes = state.annotations.map(buildAnnotationNode)
	annotationNodes.forEach((node) => contentGroup.add(node))

	const layer = new Konva.Layer()
	layer.add(contentGroup)
	stage.add(layer)

	return { contentGroup, imageNode, annotationNodes }
}

/**
 * Render the edit state to a canvas at natural resolution, optionally
 * downscaled so its longest edge is at most maxSize.
 *
 * @param oriented the orientation-baked source canvas
 * @param state the edit state
 * @param maxSize optional bound for the longest output edge
 */
export function renderToCanvas(oriented: HTMLCanvasElement, state: EditorState, maxSize?: number): HTMLCanvasElement {
	const visible = visibleRect(state, { width: oriented.width, height: oriented.height })
	const pixelRatio = maxSize === undefined
		? 1
		: Math.min(1, maxSize / Math.max(visible.width, visible.height))

	const stage = new Konva.Stage({
		// Detached container: the export stage is never displayed
		container: document.createElement('div'),
		width: visible.width,
		height: visible.height,
	})
	try {
		renderScene(stage, oriented, state, {
			scale: 1,
			offset: { x: 0, y: 0 },
			showCropped: true,
		})
		return stage.toCanvas({ pixelRatio })
	} finally {
		stage.destroy()
	}
}

/**
 * Convert a stage-space pointer position to oriented image coordinates.
 *
 * @param pointer the stage pointer position
 * @param pointer.x horizontal stage coordinate
 * @param pointer.y vertical stage coordinate
 * @param state the edit state
 * @param oriented the oriented image size
 * @param options the current view transform
 */
export function toImageCoords(
	pointer: { x: number, y: number },
	state: EditorState,
	oriented: Size,
	options: SceneOptions,
): { x: number, y: number } {
	const visible = visibleRect(state, oriented)
	return {
		x: (pointer.x - options.offset.x) / options.scale + (options.showCropped ? visible.x : 0),
		y: (pointer.y - options.offset.y) / options.scale + (options.showCropped ? visible.y : 0),
	}
}
