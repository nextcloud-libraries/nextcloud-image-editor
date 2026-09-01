/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Annotation, EditorState, Size } from './state.ts'

import Konva from 'konva'
import { cool, fade, noir, warm } from './filters.ts'

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
 * Obfuscate a region of the oriented image: pixelate averages it into
 * coarse blocks, blur applies a strong gaussian. Either way the
 * information is destroyed in the exported pixels, not overlaid.
 *
 * @param oriented the orientation-baked source canvas
 * @param rect the region to obfuscate
 * @param rect.x horizontal region origin
 * @param rect.y vertical region origin
 * @param rect.width region width
 * @param rect.height region height
 * @param style pixelate or blur
 */
function obfuscate(
	oriented: HTMLCanvasElement,
	rect: { x: number, y: number, width: number, height: number },
	style: 'pixelate' | 'blur',
): HTMLCanvasElement {
	const strength = Math.max(4, Math.round(Math.min(oriented.width, oriented.height) / 40))
	const out = document.createElement('canvas')
	out.width = Math.max(1, Math.ceil(rect.width))
	out.height = Math.max(1, Math.ceil(rect.height))
	const context = out.getContext('2d')!

	if (style === 'blur') {
		// Draw with padding so the blur does not bleed transparency in
		// from the edges, the canvas bounds crop the padding again
		const pad = strength * 2
		context.filter = `blur(${strength}px)`
		context.drawImage(
			oriented,
			rect.x - pad,
			rect.y - pad,
			rect.width + pad * 2,
			rect.height + pad * 2,
			-pad,
			-pad,
			out.width + pad * 2,
			out.height + pad * 2,
		)
		return out
	}

	const small = document.createElement('canvas')
	small.width = Math.max(1, Math.ceil(rect.width / strength))
	small.height = Math.max(1, Math.ceil(rect.height / strength))
	small.getContext('2d')!
		.drawImage(oriented, rect.x, rect.y, rect.width, rect.height, 0, 0, small.width, small.height)
	context.imageSmoothingEnabled = false
	context.drawImage(small, 0, 0, out.width, out.height)
	return out
}

/**
 * Build the Konva node for one annotation. Nodes carry the annotation id
 * and the 'annotation' name so tools can map them back to state entries.
 *
 * @param annotation the annotation to render
 * @param oriented the orientation-baked source canvas, needed by redact
 */
export function buildAnnotationNode(annotation: Annotation, oriented?: HTMLCanvasElement): Konva.Shape {
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
				rotation: annotation.rotation,
				stroke: annotation.color,
				strokeWidth: annotation.strokeWidth,
			})
		case 'ellipse':
			// Positioned at the rect's top-left with a negative offset so
			// the rotation pivots on the same anchor as rectangles
			return new Konva.Ellipse({
				...base,
				x: annotation.rect.x,
				y: annotation.rect.y,
				offsetX: -annotation.rect.width / 2,
				offsetY: -annotation.rect.height / 2,
				radiusX: annotation.rect.width / 2,
				radiusY: annotation.rect.height / 2,
				rotation: annotation.rotation,
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
				// Kept in sync with the text overlay for WYSIWYG editing
				fontFamily: 'Helvetica, Arial, sans-serif',
			})
		case 'redact': {
			if (oriented === undefined) {
				throw new Error('Redaction requires the oriented image')
			}
			return new Konva.Image({
				...base,
				image: obfuscate(oriented, annotation.rect, annotation.style),
				x: annotation.rect.x,
				y: annotation.rect.y,
			})
		}
	}
}

/**
 * Apply adjustments and the filter preset to the image node.
 * Konva filters require the node to be cached; the cache is dropped
 * again when no filter is active.
 *
 * @param node the Konva image node
 * @param state the edit state
 * @param pixelRatio cache resolution: 1 for exports, the view scale for
 * interactive rendering so slider drags stay smooth on large images
 */
export function applyFilters(node: Konva.Image, state: EditorState, pixelRatio = 1): void {
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
	const presetFilters = {
		none: null,
		grayscale: Konva.Filters.Grayscale,
		noir,
		sepia: Konva.Filters.Sepia,
		fade,
		warm,
		cool,
		invert: Konva.Filters.Invert,
		solarize: Konva.Filters.Solarize,
		posterize: Konva.Filters.Posterize,
		pop: Konva.Filters.Enhance,
	}[state.preset]
	if (presetFilters !== null) {
		filters.push(presetFilters)
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
	if (state.preset === 'posterize') {
		// Konva maps levels() over 254 steps: 0.02 gives about six bands
		node.levels(0.02)
	}
	if (state.preset === 'pop') {
		node.enhance(0.25)
	}
	node.cache({ pixelRatio })
}

/**
 * Small data-URL preview of the visible image with a preset applied,
 * for the filter picker chips.
 *
 * @param oriented the orientation-baked source canvas
 * @param state the current edit state
 * @param preset the preset to preview instead of the active one
 * @param size bound for the longest thumbnail edge
 */
export function presetThumbnail(oriented: HTMLCanvasElement, state: EditorState, preset: EditorState['preset'], size = 96): string {
	const visible = visibleRect(state, { width: oriented.width, height: oriented.height })
	const scale = Math.min(size / visible.width, size / visible.height)
	const thumb = document.createElement('canvas')
	thumb.width = Math.max(1, Math.round(visible.width * scale))
	thumb.height = Math.max(1, Math.round(visible.height * scale))
	thumb.getContext('2d')!
		.drawImage(oriented, visible.x, visible.y, visible.width, visible.height, 0, 0, thumb.width, thumb.height)

	const stage = new Konva.Stage({
		container: document.createElement('div'),
		width: thumb.width,
		height: thumb.height,
	})
	try {
		const node = new Konva.Image({ image: thumb, listening: false })
		applyFilters(node, { ...state, preset })
		const layer = new Konva.Layer()
		layer.add(node)
		stage.add(layer)
		return stage.toDataURL()
	} finally {
		stage.destroy()
	}
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
	// Interactive rendering caches at display resolution; exports call
	// with scale 1 and keep full quality
	applyFilters(imageNode, state, Math.min(1, options.scale * (globalThis.devicePixelRatio || 1)))
	contentGroup.add(imageNode)

	const annotationNodes = state.annotations.map((annotation) => buildAnnotationNode(annotation, oriented))
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
