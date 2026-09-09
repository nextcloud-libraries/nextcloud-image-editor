/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Annotation, EditorState, RedactAnnotation, Size } from './state.ts'

import Konva from 'konva'
import { canvasScaleFor } from './canvas-limits.ts'
import { berry, cinema, coast, cool, fade, golden, luna, mist, noir, saturate, sharpen, tonal, tone, vignette, warm } from './filters.ts'
import { fontStack } from './fonts.ts'
import { levelFor } from './mipmap.ts'
import { redactShape } from './redact-shape.ts'
import { textAlign } from './text-align.ts'
import { outlineColor, outlineWidth } from './text-outline.ts'

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
 * 2D context of a canvas, or an error where none is available, matching
 * how orient.ts reports the same condition.
 *
 * @param canvas the canvas to draw on
 */
function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
	const context = canvas.getContext('2d')
	if (context === null) {
		throw new Error('Canvas 2D context unavailable')
	}
	return context
}

/**
 * Whether a 2D context honors the `filter` property. WebKit only
 * shipped it in Safari 18; where it is missing, the assignment is
 * ignored and the getter keeps reporting 'none'.
 *
 * @param context the context to probe, null when none is available
 */
export function supportsContextFilter(context: Pick<CanvasRenderingContext2D, 'filter'> | null): boolean {
	if (context === null) {
		return false
	}
	context.filter = 'blur(1px)'
	return context.filter !== 'none'
}

/** Probed once: the answer cannot change within a document */
let contextFilterSupport: boolean | null = null

/**
 * Memoized probe of canvas filter support in this browser.
 */
function contextFilterAvailable(): boolean {
	contextFilterSupport ??= supportsContextFilter(document.createElement('canvas').getContext('2d'))
	return contextFilterSupport
}

/**
 * Obfuscate a region that has already been cut out of the picture:
 * pixelate averages it into coarse blocks, blur applies a gaussian.
 * Either way the information is destroyed in the exported pixels, not
 * overlaid.
 *
 * Blur needs canvas filter support. Without it the region would be
 * drawn untouched while the interface claims it is redacted, so the
 * style silently degrades to pixelation: obfuscating differently than
 * asked is recoverable, exporting readable pixels is not.
 *
 * @param region the cut-out region, obfuscated in place
 * @param style pixelate or blur
 * @param strength block size for pixelation, radius for blur, both in
 * the pixels of the region itself
 */
function obfuscateRegion(
	region: HTMLCanvasElement,
	style: 'pixelate' | 'blur',
	strength: number,
): HTMLCanvasElement {
	const out = document.createElement('canvas')
	out.width = region.width
	out.height = region.height
	const context = context2d(out)

	if (style === 'blur' && contextFilterAvailable()) {
		context.filter = `blur(${strength}px)`
		context.drawImage(region, 0, 0)
		return out
	}

	const small = document.createElement('canvas')
	small.width = Math.max(1, Math.ceil(region.width / strength))
	small.height = Math.max(1, Math.ceil(region.height / strength))
	context2d(small).drawImage(region, 0, 0, small.width, small.height)
	context.imageSmoothingEnabled = false
	context.drawImage(small, 0, 0, out.width, out.height)
	return out
}

/**
 * Cut a region out of an obfuscated patch and keep only what falls
 * inside the ellipse it encloses, so the patch has the outline of the
 * thing being hidden rather than a box around it. The edge is drawn
 * antialiased and composited, not stepped.
 *
 * @param patch the obfuscated patch to cut from
 * @param x horizontal origin of the region within the patch
 * @param y vertical origin of the region within the patch
 * @param width region width
 * @param height region height
 */
function cutEllipse(
	patch: HTMLCanvasElement,
	x: number,
	y: number,
	width: number,
	height: number,
): HTMLCanvasElement {
	const out = document.createElement('canvas')
	out.width = width
	out.height = height
	const context = context2d(out)
	context.drawImage(patch, x, y, width, height, 0, 0, width, height)
	context.globalCompositeOperation = 'destination-in'
	context.beginPath()
	context.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2)
	context.fill()
	return out
}

/**
 * How coarse a redaction is, in the pixels of the source image, so that
 * a redaction looks the same however far the view happens to be zoomed.
 *
 * @param source the oriented image size
 */
function redactStrength(source: Size): number {
	return Math.max(4, Math.round(Math.min(source.width, source.height) / 40))
}

/**
 * Draw a redaction by obfuscating whatever has already been drawn
 * underneath it.
 *
 * Konva draws the children of a layer onto one canvas in order, so by
 * the time this runs the picture and every annotation below this one
 * are already on that canvas and can be read back. Sampling the source
 * image instead, as this used to, obfuscates the original pixels and
 * paints them over the top: anything drawn underneath survives, and the
 * adjustments never reach the patch either, since those are applied to
 * the image node rather than baked into the source.
 *
 * @param annotation the redaction to draw
 * @param strength coarseness in source image pixels
 */
function redactSceneFunc(annotation: RedactAnnotation, strength: number) {
	return (context: Konva.Context, shape: Konva.Shape): void => {
		const canvas = context.canvas
		// Konva runs the scene function a second time against the hit
		// canvas, where every shape is painted in its own hit colour.
		// Reading that back would obfuscate the hit colours, not the photo
		if ((canvas as { hitCanvas?: boolean }).hitCanvas === true) {
			return
		}

		const width = shape.width()
		const height = shape.height()
		const transform = shape.getAbsoluteTransform()
		const topLeft = transform.point({ x: 0, y: 0 })
		const bottomRight = transform.point({ x: width, y: height })
		const ratio = canvas.pixelRatio || 1

		// The region as it exists on the canvas being drawn on, which is
		// the view scale on screen and the full image on export
		const left = Math.round(topLeft.x * ratio)
		const top = Math.round(topLeft.y * ratio)
		const deviceWidth = Math.round(bottomRight.x * ratio) - left
		const deviceHeight = Math.round(bottomRight.y * ratio) - top
		if (deviceWidth < 1 || deviceHeight < 1 || width <= 0 || height <= 0) {
			return
		}
		const deviceStrength = Math.max(2, Math.round(strength * (deviceWidth / width)))

		// A blur reads beyond the region so it has real pixels to pull in
		// at the edges instead of whatever lies outside the canvas
		const pad = annotation.style === 'blur' ? deviceStrength * 2 : 0
		const readLeft = Math.max(0, left - pad)
		const readTop = Math.max(0, top - pad)
		const readWidth = Math.min(canvas.width, left + deviceWidth + pad) - readLeft
		const readHeight = Math.min(canvas.height, top + deviceHeight + pad) - readTop
		if (readWidth < 1 || readHeight < 1) {
			return
		}

		const region = document.createElement('canvas')
		region.width = readWidth
		region.height = readHeight
		context2d(region).putImageData(context.getImageData(readLeft, readTop, readWidth, readHeight), 0, 0)

		const patch = obfuscateRegion(region, annotation.style, deviceStrength)
		if (redactShape(annotation.shape) === 'ellipse') {
			const cut = cutEllipse(patch, left - readLeft, top - readTop, deviceWidth, deviceHeight)
			context.drawImage(cut, 0, 0, width, height)
			return
		}
		context.drawImage(
			patch,
			left - readLeft,
			top - readTop,
			deviceWidth,
			deviceHeight,
			0,
			0,
			width,
			height,
		)
	}
}

/**
 * What an annotation renders to. Text on a plate is a label, which holds
 * the plate and the text together; everything else is a single shape.
 */
export type AnnotationNode = Konva.Shape | Konva.Label

/**
 * Breathing room between the text and the edge of its plate.
 *
 * @param fontSize the size of the text sitting on it
 */
function backgroundPadding(fontSize: number): number {
	return Math.max(2, Math.round(fontSize / 6))
}

/**
 * Build the Konva node for one annotation. Nodes carry the annotation id
 * and the 'annotation' name so tools can map them back to state entries.
 *
 * @param annotation the annotation to render
 * @param source the source image size, needed by redact for its coarseness
 */
export function buildAnnotationNode(annotation: Annotation, source?: Size): AnnotationNode {
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
		case 'line':
			return new Konva.Line({
				...base,
				points: [...annotation.points],
				stroke: annotation.color,
				strokeWidth: annotation.strokeWidth,
				lineCap: 'round',
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
		case 'sticker': {
			const text = new Konva.Text({
				...base,
				x: annotation.x,
				y: annotation.y,
				text: annotation.text,
				fill: annotation.color,
				fontSize: annotation.fontSize,
				rotation: annotation.rotation,
				// Kept in sync with the text overlay for WYSIWYG editing
				fontFamily: fontStack(annotation.font),
				align: textAlign(annotation.align),
				...(annotation.outline === true
					? {
							stroke: outlineColor(annotation.color),
							strokeWidth: outlineWidth(annotation.fontSize),
							// The edge sits behind the glyph rather than eating
							// into it, which is what keeps small text legible
							fillAfterStrokeEnabled: true,
						}
					: {}),
				...(annotation.background === true ? { padding: backgroundPadding(annotation.fontSize) } : {}),
			})
			if (annotation.background !== true) {
				return text
			}
			// A label is the one node Konva has that keeps a plate sized to
			// the text on it, so the two cannot drift apart as it is edited
			const label = new Konva.Label({ ...base, x: annotation.x, y: annotation.y, rotation: annotation.rotation })
			text.position({ x: 0, y: 0 })
			text.rotation(0)
			label.add(new Konva.Tag({ fill: outlineColor(annotation.color), cornerRadius: 2 }))
			label.add(text)
			return label
		}
		case 'redact': {
			if (source === undefined) {
				throw new Error('Redaction requires the source image size')
			}
			const { rect } = annotation
			return new Konva.Shape({
				...base,
				x: rect.x,
				y: rect.y,
				width: rect.width,
				height: rect.height,
				// Something has to be fillable for the shape to register on
				// the hit canvas; what is drawn there is the hit colour
				fill: 'black',
				sceneFunc: redactSceneFunc(annotation, redactStrength(source)),
				hitFunc: (context, shape) => {
					const shapeWidth = shape.width()
					const shapeHeight = shape.height()
					context.beginPath()
					if (redactShape(annotation.shape) === 'ellipse') {
						context.ellipse(
							shapeWidth / 2,
							shapeHeight / 2,
							shapeWidth / 2,
							shapeHeight / 2,
							0,
							0,
							Math.PI * 2,
						)
					} else {
						context.rect(0, 0, shapeWidth, shapeHeight)
					}
					context.closePath()
					context.fillStrokeShape(shape)
				},
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
	const { exposure, brightness, contrast, saturation, temperature, tint } = state.adjustments
	const { highlights, shadows } = state.adjustments
	const filters = []

	// Exposure, temperature and tint are one filter over the pixels
	if (exposure !== 0 || temperature !== 0 || tint !== 0) {
		filters.push(tone)
	}
	if (brightness !== 0) {
		filters.push(Konva.Filters.Brighten)
	}
	if (contrast !== 0) {
		filters.push(Konva.Filters.Contrast)
	}
	if (saturation !== 0) {
		filters.push(saturate)
	}
	// After the channel scaling above, so the ends of the range are
	// weighted by the light the image actually ended up with
	if (highlights !== 0 || shadows !== 0) {
		filters.push(tonal)
	}
	const presetFilters = {
		none: null,
		grayscale: Konva.Filters.Grayscale,
		noir,
		luna,
		sepia: Konva.Filters.Sepia,
		fade,
		warm,
		cool,
		golden,
		coast,
		mist,
		berry,
		cinema,
		invert: Konva.Filters.Invert,
		solarize: Konva.Filters.Solarize,
		posterize: Konva.Filters.Posterize,
		pop: Konva.Filters.Enhance,
	}[state.preset]
	if (presetFilters !== null) {
		filters.push(presetFilters)
	}
	// Last, so it sharpens the image the user is actually looking at
	// rather than the one before the preset graded it
	if (state.adjustments.sharpen !== 0) {
		filters.push(sharpen)
	}
	// After everything, including the preset: a vignette is a frame around
	// the finished picture rather than part of its grade
	if (state.adjustments.vignette !== 0) {
		filters.push(vignette)
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
	// Konva owns no attribute for these, so they ride along on the node
	node.setAttr('exposure', exposure / 100)
	node.setAttr('temperature', temperature / 100)
	node.setAttr('tint', tint / 100)
	node.setAttr('sharpen', state.adjustments.sharpen / 100)
	node.setAttr('highlights', highlights / 100)
	node.setAttr('shadows', shadows / 100)
	node.setAttr('vignette', state.adjustments.vignette / 100)
	if (state.preset === 'posterize') {
		// Konva maps levels() over 254 steps: 0.02 gives about six bands
		node.levels(0.02)
	}
	if (state.preset === 'pop') {
		node.enhance(0.25)
	}
	// The cache is a canvas of its own, so it is bounded like every other
	const cacheFit = canvasScaleFor({
		width: node.width() * pixelRatio,
		height: node.height() * pixelRatio,
	})
	node.cache({ pixelRatio: pixelRatio * cacheFit })
}

/**
 * What a set of preset thumbnails depends on, the preset aside: the
 * visible area and the adjustments baked into every one of them.
 * Picking a preset or editing an annotation changes neither, so the
 * thumbnails do not have to be redrawn for those.
 *
 * @param state the current edit state
 */
export function thumbnailKey(state: EditorState): string {
	const { crop, adjustments } = state
	return [
		crop?.x,
		crop?.y,
		crop?.width,
		crop?.height,
		...Object.values(adjustments),
	].join('|')
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
	context2d(thumb)
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
	/**
	 * Cache filters at display resolution instead of full resolution.
	 * Only wanted while a slider is actively scrubbing: it keeps drags
	 * smooth on large images, at rest the cache must be full quality.
	 */
	fastFilters?: boolean
}

export interface Scene {
	/** Carries the view transform and the crop clip; owned by update() */
	viewGroup: Konva.Group
	/**
	 * The group transitions animate: identity outside a transition, so
	 * tweens and reconciliation never write the same attributes
	 */
	contentGroup: Konva.Group
	imageNode: Konva.Image
	/** Reconcile the stage content with the given state and view */
	update(oriented: HTMLCanvasElement, state: EditorState, options: SceneOptions): void
	destroy(): void
}

/**
 * Create a persistent scene on the stage. update() reconciles instead
 * of rebuilding: the image node survives every call, annotation nodes
 * are keyed by id and only rebuilt when their state entry changed, and
 * the filter cache is only redone when its inputs changed. One code
 * path still renders both the interactive view and the export.
 *
 * @param stage the target stage
 */
export function createScene(stage: Konva.Stage): Scene {
	const layer = new Konva.Layer()
	const viewGroup = new Konva.Group({ name: 'view' })
	const contentGroup = new Konva.Group({ name: 'content' })
	const imageNode = new Konva.Image({ image: undefined, listening: false })
	contentGroup.add(imageNode)
	viewGroup.add(contentGroup)
	layer.add(viewGroup)
	stage.add(layer)

	// Which state entry each node was built from, and the inputs of the
	// current filter cache: reference equality decides whether work is due
	const built = new Map<string, { annotation: Annotation, node: AnnotationNode }>()
	let filterKey = ''

	const update = (oriented: HTMLCanvasElement, state: EditorState, options: SceneOptions): void => {
		// Shown smaller than it is, the picture is drawn from a copy near
		// the size it lands at, scaled back up to the space it occupies
		const level = levelFor(oriented, options.scale * layer.getCanvas().getPixelRatio())
		const imageChanged = imageNode.image() !== level
		if (imageChanged) {
			imageNode.image(level)
			imageNode.scale({ x: oriented.width / level.width, y: oriented.height / level.height })
		}

		// While the crop tool shows the full image for context, the view
		// origin is the image corner instead of the crop corner
		const origin = options.showCropped
			? visibleRect(state, { width: oriented.width, height: oriented.height })
			: { x: 0, y: 0 }
		viewGroup.position({
			x: options.offset.x - origin.x * options.scale,
			y: options.offset.y - origin.y * options.scale,
		})
		viewGroup.scale({ x: options.scale, y: options.scale })
		if (options.showCropped && state.crop !== null) {
			viewGroup.clip(state.crop)
		} else {
			// Konva clips whenever clipWidth is set: unset it to disable
			viewGroup.clipWidth(undefined as unknown as number)
			viewGroup.clipHeight(undefined as unknown as number)
		}

		const pixelRatio = options.fastFilters
			? Math.min(1, options.scale * imageNode.scaleX() * (globalThis.devicePixelRatio || 1))
			: 1
		// Every adjustment, so a change to any of them redoes the cache
		const nextFilterKey = `${Object.values(state.adjustments).join('|')}|${state.preset}|${pixelRatio}`
		if (imageChanged || nextFilterKey !== filterKey) {
			applyFilters(imageNode, state, pixelRatio)
			filterKey = nextFilterKey
		}

		// Keyed reconciliation: a changed entry reference means the node
		// is stale. Redactions read what is beneath them as they draw, so
		// they need no rebuild when the picture under them changes
		const seen = new Set<string>()
		const sourceSize = { width: oriented.width, height: oriented.height }
		for (const annotation of state.annotations) {
			seen.add(annotation.id)
			const entry = built.get(annotation.id)
			if (entry !== undefined && entry.annotation === annotation) {
				continue
			}
			entry?.node.destroy()
			const node = buildAnnotationNode(annotation, sourceSize)
			contentGroup.add(node)
			built.set(annotation.id, { annotation, node })
		}
		for (const [id, entry] of built) {
			if (!seen.has(id)) {
				entry.node.destroy()
				built.delete(id)
			}
		}

		// Stacking order: image at the bottom, annotations in state order
		imageNode.zIndex(0)
		state.annotations.forEach((annotation, index) => built.get(annotation.id)!.node.zIndex(index + 1))
	}

	return {
		viewGroup,
		contentGroup,
		imageNode,
		update,
		destroy: () => {
			built.clear()
			layer.destroy()
		},
	}
}

/**
 * One-shot render of the edit state onto a fresh stage, for exports and
 * thumbnails where nothing needs to persist.
 *
 * @param stage the target stage, expected to be empty
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
	const scene = createScene(stage)
	scene.update(oriented, state, options)
	return scene
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
	const requested = maxSize === undefined
		? 1
		: Math.min(1, maxSize / Math.max(visible.width, visible.height))
	// Past the cap the exported canvas comes back blank rather than
	// throwing, so a smaller export beats one that is empty
	const pixelRatio = requested * canvasScaleFor({
		width: visible.width * requested,
		height: visible.height * requested,
	})

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
