/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export type Rotation = 0 | 90 | 180 | 270

export interface Size {
	width: number
	height: number
}

export interface Rect {
	x: number
	y: number
	width: number
	height: number
}

/** All values range from -100 to 100, 0 meaning unchanged */
export interface Adjustments {
	brightness: number
	contrast: number
	saturation: number
}

export type FilterPreset
	= | 'none'
		| 'grayscale'
		| 'noir'
		| 'sepia'
		| 'fade'
		| 'warm'
		| 'cool'
		| 'invert'
		| 'solarize'
		| 'posterize'
		| 'pop'

export interface DrawAnnotation {
	id: string
	type: 'draw'
	/** Flat [x1, y1, x2, y2, …] polyline in oriented image coordinates */
	points: number[]
	color: string
	strokeWidth: number
}

export interface ArrowAnnotation {
	id: string
	type: 'arrow'
	/** [fromX, fromY, toX, toY] in oriented image coordinates */
	points: [number, number, number, number]
	color: string
	strokeWidth: number
}

export interface BoxAnnotation {
	id: string
	type: 'rectangle' | 'ellipse'
	/** The shape's local frame: rotation pivots on the rect's top-left */
	rect: Rect
	/** Clockwise degrees around the rect's top-left corner */
	rotation: number
	color: string
	strokeWidth: number
}

export interface TextAnnotation {
	id: string
	type: 'text' | 'sticker'
	x: number
	y: number
	/** Text content, or the emoji character for stickers */
	text: string
	color: string
	fontSize: number
	/** Clockwise degrees around the anchor */
	rotation: number
}

export interface RedactAnnotation {
	id: string
	type: 'redact'
	/** Region to obfuscate, in oriented image coordinates */
	rect: Rect
	/** How the region is destroyed */
	style: 'pixelate' | 'blur'
}

export type Annotation = DrawAnnotation | ArrowAnnotation | BoxAnnotation | TextAnnotation | RedactAnnotation

export interface EditorState {
	rotation: Rotation
	/** Additional free rotation in degrees, -45 to 45 */
	fineRotation: number
	/** Center zoom factor, 1 or greater */
	zoom: number
	flipX: boolean
	flipY: boolean
	/** Crop rectangle in oriented image coordinates, null meaning uncropped */
	crop: Rect | null
	adjustments: Adjustments
	preset: FilterPreset
	annotations: Annotation[]
}

/**
 * A pristine edit state: nothing rotated, cropped, adjusted or annotated.
 */
export function createInitialState(): EditorState {
	return {
		rotation: 0,
		fineRotation: 0,
		zoom: 1,
		flipX: false,
		flipY: false,
		crop: null,
		adjustments: { brightness: 0, contrast: 0, saturation: 0 },
		preset: 'none',
		annotations: [],
	}
}

/**
 * Size of the image after applying the state rotation.
 *
 * @param natural the natural image size
 * @param rotation the applied rotation
 */
export function orientedSize(natural: Size, rotation: Rotation): Size {
	return rotation % 180 === 0
		? { width: natural.width, height: natural.height }
		: { width: natural.height, height: natural.width }
}

/**
 * Clamp a rectangle into the given bounds, keeping at least 1px of area.
 *
 * @param rect the rectangle to clamp
 * @param bounds the containing size
 */
export function clampRect(rect: Rect, bounds: Size): Rect {
	const x = Math.min(Math.max(rect.x, 0), bounds.width - 1)
	const y = Math.min(Math.max(rect.y, 0), bounds.height - 1)
	return {
		x,
		y,
		width: Math.max(1, Math.min(rect.width, bounds.width - x)),
		height: Math.max(1, Math.min(rect.height, bounds.height - y)),
	}
}

/**
 * Rotate a flat point list 90° clockwise: (x, y) becomes (height - y, x).
 *
 * @param points flat [x1, y1, …] list
 * @param height oriented image height before the rotation
 */
function mapPointsCW(points: number[], height: number): number[] {
	const mapped: number[] = []
	for (let i = 0; i < points.length; i += 2) {
		mapped.push(height - (points[i + 1] ?? 0), points[i] ?? 0)
	}
	return mapped
}

/**
 * Rotate a rectangle 90° clockwise, swapping its dimensions.
 *
 * @param rect the rectangle to rotate
 * @param height oriented image height before the rotation
 */
function mapRectCW(rect: Rect, height: number): Rect {
	return {
		x: height - rect.y - rect.height,
		y: rect.x,
		width: rect.height,
		height: rect.width,
	}
}

/**
 * Rotate one annotation 90° clockwise.
 *
 * @param annotation the annotation to rotate
 * @param height oriented image height before the rotation
 */
function mapAnnotationCW(annotation: Annotation, height: number): Annotation {
	switch (annotation.type) {
		case 'draw':
			return { ...annotation, points: mapPointsCW(annotation.points, height) }
		case 'arrow':
			return { ...annotation, points: mapPointsCW(annotation.points, height) as ArrowAnnotation['points'] }
		case 'rectangle':
		case 'ellipse':
			// The anchor maps like a point and the rotation field absorbs
			// the quarter turn; the local frame (width/height) is untouched
			return {
				...annotation,
				rect: { ...annotation.rect, x: height - annotation.rect.y, y: annotation.rect.x },
				rotation: (annotation.rotation + 90) % 360,
			}
		case 'redact':
			return { ...annotation, rect: mapRectCW(annotation.rect, height) }
		case 'text':
		case 'sticker':
			return {
				...annotation,
				x: height - annotation.y,
				y: annotation.x,
				rotation: (annotation.rotation + 90) % 360,
			}
	}
}

/**
 * Rotate the whole edit state 90° clockwise: crop and annotation
 * coordinates are remapped into the new oriented space.
 *
 * @param state the current state
 * @param oriented the oriented image size before this rotation
 */
export function rotateCW(state: EditorState, oriented: Size): EditorState {
	return {
		...state,
		rotation: (state.rotation + 90) % 360 as Rotation,
		crop: state.crop && mapRectCW(state.crop, oriented.height),
		annotations: state.annotations.map((annotation) => mapAnnotationCW(annotation, oriented.height)),
	}
}

/**
 * Mirror one annotation horizontally.
 *
 * @param annotation the annotation to mirror
 * @param width current oriented image width
 */
function mapAnnotationFlipX(annotation: Annotation, width: number): Annotation {
	switch (annotation.type) {
		case 'draw':
		case 'arrow': {
			const points = annotation.points.map((value, i) => (i % 2 === 0 ? width - value : value))
			return { ...annotation, points } as Annotation
		}
		case 'rectangle':
		case 'ellipse': {
			// Exact mirror: the new anchor is the mirrored image of the
			// rotated top-right corner, with the rotation direction negated
			const radians = (annotation.rotation * Math.PI) / 180
			return {
				...annotation,
				rect: {
					...annotation.rect,
					x: width - annotation.rect.x - annotation.rect.width * Math.cos(radians),
					y: annotation.rect.y + annotation.rect.width * Math.sin(radians),
				},
				rotation: (360 - annotation.rotation) % 360,
			}
		}
		case 'redact':
			return {
				...annotation,
				rect: { ...annotation.rect, x: width - annotation.rect.x - annotation.rect.width },
			}
		case 'text':
		case 'sticker':
			// The anchor is mirrored but glyphs stay readable, so the
			// rotation direction inverts to keep the visual placement
			return {
				...annotation,
				x: width - annotation.x,
				rotation: (360 - annotation.rotation) % 360,
			}
	}
}

/**
 * Mirror the whole edit state horizontally in oriented space.
 *
 * @param state the current state
 * @param oriented the current oriented image size
 */
export function flipHorizontal(state: EditorState, oriented: Size): EditorState {
	// Rendering bakes the mirror in source space before rotating, so a
	// visually horizontal flip toggles the source vertical axis when the
	// image lies on its side
	const sideways = state.rotation % 180 !== 0
	return {
		...state,
		flipX: sideways ? state.flipX : !state.flipX,
		flipY: sideways ? !state.flipY : state.flipY,
		fineRotation: -state.fineRotation,
		crop: state.crop && { ...state.crop, x: oriented.width - state.crop.x - state.crop.width },
		annotations: state.annotations.map((annotation) => mapAnnotationFlipX(annotation, oriented.width)),
	}
}

/**
 * Mirror one annotation vertically.
 *
 * @param annotation the annotation to mirror
 * @param height current oriented image height
 */
function mapAnnotationFlipY(annotation: Annotation, height: number): Annotation {
	switch (annotation.type) {
		case 'draw':
		case 'arrow': {
			const points = annotation.points.map((value, i) => (i % 2 === 1 ? height - value : value))
			return { ...annotation, points } as Annotation
		}
		case 'rectangle':
		case 'ellipse': {
			const radians = (annotation.rotation * Math.PI) / 180
			return {
				...annotation,
				rect: {
					...annotation.rect,
					x: annotation.rect.x - annotation.rect.height * Math.sin(radians),
					y: height - annotation.rect.y - annotation.rect.height * Math.cos(radians),
				},
				rotation: (360 - annotation.rotation) % 360,
			}
		}
		case 'redact':
			return {
				...annotation,
				rect: { ...annotation.rect, y: height - annotation.rect.y - annotation.rect.height },
			}
		case 'text':
		case 'sticker':
			return {
				...annotation,
				y: height - annotation.y,
				rotation: (360 - annotation.rotation) % 360,
			}
	}
}

/**
 * Mirror the whole edit state vertically in oriented space.
 *
 * @param state the current state
 * @param oriented the current oriented image size
 */
export function flipVertical(state: EditorState, oriented: Size): EditorState {
	const sideways = state.rotation % 180 !== 0
	return {
		...state,
		flipX: sideways ? !state.flipX : state.flipX,
		flipY: sideways ? state.flipY : !state.flipY,
		fineRotation: -state.fineRotation,
		crop: state.crop && { ...state.crop, y: oriented.height - state.crop.y - state.crop.height },
		annotations: state.annotations.map((annotation) => mapAnnotationFlipY(annotation, oriented.height)),
	}
}

/**
 * Move an annotation by the given delta.
 *
 * @param annotation the annotation to move
 * @param dx horizontal shift in oriented image pixels
 * @param dy vertical shift in oriented image pixels
 */
export function translateAnnotation(annotation: Annotation, dx: number, dy: number): Annotation {
	switch (annotation.type) {
		case 'draw':
		case 'arrow': {
			const points = annotation.points.map((value, i) => value + (i % 2 === 0 ? dx : dy))
			return { ...annotation, points } as Annotation
		}
		case 'rectangle':
		case 'ellipse':
		case 'redact':
			return {
				...annotation,
				rect: { ...annotation.rect, x: annotation.rect.x + dx, y: annotation.rect.y + dy },
			}
		case 'text':
		case 'sticker':
			return { ...annotation, x: annotation.x + dx, y: annotation.y + dy }
	}
}

/**
 * Clone an annotation under a new id, shifted so the copy is visible
 * next to the original.
 *
 * @param annotation the annotation to duplicate
 * @param offset shift applied to the copy, in oriented image pixels
 */
export function duplicateAnnotation(annotation: Annotation, offset = 16): Annotation {
	return { ...translateAnnotation(annotation, offset, offset), id: crypto.randomUUID() }
}
