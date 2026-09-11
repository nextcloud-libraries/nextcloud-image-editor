/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type Konva from 'konva'
import type { Tool } from './context.ts'
import type { RedactShape } from './redact-shape.ts'
import type { AnnotationNode } from './render.ts'
import type { Annotation, EditorState, TextAnnotation } from './state.ts'

import { snapAngle } from '../utils/geometry.ts'
import { newId } from '../utils/id.ts'
import { t } from '../utils/l10n.ts'
import { buildAnnotationNode } from './render.ts'

export interface ToolOptions {
	color: string
	strokeWidth: number
	fontSize: number
	sticker: string
	redactStyle: 'pixelate' | 'blur'
	/** The outline a new redaction takes */
	redactShape: RedactShape
}

export interface PointerToolDeps {
	stage: Konva.Stage
	/** Content group receiving the live preview node while dragging */
	contentGroup(): Konva.Group | null
	getState(): EditorState
	commit(state: EditorState, label?: string): void
	/** Convert a stage pointer position to oriented image coordinates */
	toScene(pointer: { x: number, y: number }): { x: number, y: number }
	/** The orientation-baked source canvas, needed by redact previews */
	oriented(): HTMLCanvasElement | null
	options(): ToolOptions
	/** Whether a view pan currently owns the pointer */
	panning(): boolean
	/** Open the text editing overlay at the given scene position */
	startTextEdit(position: { x: number, y: number }): void
}

/** What each tool calls the step it records, for the history list */
const TOOL_LABELS: Partial<Record<Tool, string>> = {
	draw: t('Draw'),
	rectangle: t('Rectangle'),
	ellipse: t('Ellipse'),
	arrow: t('Arrow'),
	line: t('Line'),
	sticker: t('Sticker'),
	redact: t('Redact'),
}

/**
 * Attach the pointer handlers for the drawing-style tools to the stage.
 * Returns a cleanup function removing the handlers again.
 *
 * @param tool the active tool
 * @param deps stage access and state callbacks
 */
export function attachPointerTools(tool: Tool, deps: PointerToolDeps): () => void {
	if (!['draw', 'rectangle', 'ellipse', 'arrow', 'line', 'text', 'sticker', 'redact'].includes(tool)) {
		return () => {}
	}

	let active: Annotation | null = null
	let previewNode: AnnotationNode | null = null
	let start = { x: 0, y: 0 }
	let pendingText: { x: number, y: number } | null = null
	/** Where the pointer last was, so a modifier can re-place the end */
	let last = { x: 0, y: 0 }
	/** Whether a line is held to 45° steps: Shift as in other editors, or Ctrl */
	let constrained = false

	const scenePointer = () => {
		const pointer = deps.stage.getPointerPosition()
		return pointer === null ? null : deps.toScene(pointer)
	}

	/**
	 * Follow the active annotation with the live preview node.
	 *
	 * Point lists are pushed into the existing node: rebuilding it on
	 * every pointermove made a long freehand stroke quadratic, since
	 * each move re-created a shape carrying every point so far.
	 */
	const refreshPreview = () => {
		if (active === null) {
			previewNode?.destroy()
			previewNode = null
			return
		}
		if (previewNode !== null && (active.type === 'draw' || active.type === 'arrow' || active.type === 'line')) {
			(previewNode as Konva.Line).points(active.points)
			return
		}

		previewNode?.destroy()
		previewNode = null
		const oriented = deps.oriented()
		const source = oriented === null ? undefined : { width: oriented.width, height: oriented.height }
		// A redaction preview needs the image size to match the coarseness
		// of the committed one; without it the live preview is skipped
		if (active.type === 'redact' && source === undefined) {
			return
		}
		previewNode = buildAnnotationNode(active, source)
		// The live preview joins the content group so it shares the
		// scene transform with the final node
		deps.contentGroup()?.add(previewNode)
	}

	/**
	 * Drop the annotation in progress without committing it.
	 */
	const discard = () => {
		active = null
		pendingText = null
		previewNode?.destroy()
		previewNode = null
	}

	const onPointerDown = (event?: Konva.KonvaEventObject<PointerEvent>) => {
		const point = scenePointer()
		if (point === null || deps.panning()) {
			return
		}
		const options = deps.options()
		start = point
		last = point
		constrained = event !== undefined && (event.evt.shiftKey || event.evt.ctrlKey)

		switch (tool) {
			case 'draw':
				active = { id: newId(), type: 'draw', points: [point.x, point.y], color: options.color, strokeWidth: options.strokeWidth }
				break
			case 'arrow':
			case 'line':
				active = { id: newId(), type: tool, points: [point.x, point.y, point.x, point.y], color: options.color, strokeWidth: options.strokeWidth }
				break
			case 'rectangle':
			case 'ellipse':
				active = { id: newId(), type: tool, rect: { x: point.x, y: point.y, width: 1, height: 1 }, rotation: 0, color: options.color, strokeWidth: options.strokeWidth }
				break
			case 'redact':
				active = {
					id: newId(),
					type: 'redact',
					rect: { x: point.x, y: point.y, width: 1, height: 1 },
					style: options.redactStyle,
					shape: options.redactShape,
				}
				break
			case 'text':
				// Deferred to pointerup: opening the overlay mid-click would
				// blur (and close) it again when the click completes
				pendingText = point
				return
			case 'sticker': {
				const state = deps.getState()
				const sticker: TextAnnotation = {
					id: newId(),
					type: 'sticker',
					x: point.x,
					y: point.y,
					text: options.sticker,
					color: options.color,
					fontSize: options.fontSize * 2,
					rotation: 0,
				}
				deps.commit({ ...state, annotations: [...state.annotations, sticker] }, TOOL_LABELS.sticker)
				return
			}
		}
		refreshPreview()
	}

	/**
	 * Point the line or arrow in progress at the last pointer position,
	 * snapped to 45° when a modifier asks for it.
	 */
	const followLine = () => {
		if (active === null || (active.type !== 'arrow' && active.type !== 'line')) {
			return
		}
		const end = constrained ? snapAngle(start, last) : last
		active.points = [start.x, start.y, end.x, end.y]
	}

	const onPointerMove = (event?: Konva.KonvaEventObject<PointerEvent>) => {
		if (active === null) {
			return
		}
		// A second finger turned the gesture into a pinch: the stroke it
		// started belongs to nobody now
		if (deps.panning()) {
			discard()
			return
		}
		const point = scenePointer()
		if (point === null) {
			return
		}
		last = point
		if (event !== undefined) {
			constrained = event.evt.shiftKey || event.evt.ctrlKey
		}

		switch (active.type) {
			case 'draw':
				// Grown in place: the array belongs to this gesture until
				// pointerup hands it to the committed state
				active.points.push(point.x, point.y)
				break
			case 'arrow':
			case 'line':
				followLine()
				break
			case 'rectangle':
			case 'ellipse':
			case 'redact':
				active = {
					...active,
					rect: {
						x: Math.min(start.x, point.x),
						y: Math.min(start.y, point.y),
						width: Math.abs(point.x - start.x) || 1,
						height: Math.abs(point.y - start.y) || 1,
					},
				}
				break
		}
		refreshPreview()
	}

	const onPointerUp = () => {
		if (pendingText !== null) {
			deps.startTextEdit(pendingText)
			pendingText = null
			return
		}
		if (active === null) {
			return
		}
		const state = deps.getState()
		deps.commit({ ...state, annotations: [...state.annotations, active] }, TOOL_LABELS[tool])
		discard()
	}

	// The modifier may be pressed or released while the pointer holds
	// still, and the line should follow either way
	const onModifier = (event: KeyboardEvent) => {
		if (event.key !== 'Shift' && event.key !== 'Control') {
			return
		}
		constrained = event.type === 'keydown'
		followLine()
		refreshPreview()
	}

	deps.stage.on('pointerdown.tool', onPointerDown)
	deps.stage.on('pointermove.tool', onPointerMove)
	deps.stage.on('pointerup.tool', onPointerUp)
	// Konva only hears about pointers over its own container, so a
	// release that lands anywhere else would leave the shape stranded
	// as a preview and lose it on the next press
	window.addEventListener('pointerup', onPointerUp)
	// An interrupted gesture is not a finished one
	window.addEventListener('pointercancel', discard)
	window.addEventListener('keydown', onModifier)
	window.addEventListener('keyup', onModifier)

	return () => {
		deps.stage.off('.tool')
		window.removeEventListener('pointerup', onPointerUp)
		window.removeEventListener('pointercancel', discard)
		window.removeEventListener('keydown', onModifier)
		window.removeEventListener('keyup', onModifier)
		previewNode?.destroy()
	}
}
