/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Annotation, EditorState, TextAnnotation } from './state.ts'

import Konva from 'konva'
import { primaryColor } from '../utils/theme.ts'

export interface SelectionDeps {
	stage: Konva.Stage
	getState(): EditorState
	commit(state: EditorState): void
	select(id: string | null): void
	getSelectedId(): string | null
	/** Open the text overlay to edit an existing annotation */
	editText(annotation: TextAnnotation): void
	/**
	 * Report the selected node's stage-space bounds, null on deselect
	 *
	 * @param rect the bounds in stage pixels
	 * @param rect.x horizontal position
	 * @param rect.y vertical position
	 * @param rect.width bound width
	 * @param rect.height bound height
	 */
	onSelectionRect(rect: { x: number, y: number, width: number, height: number } | null): void
}

/**
 * The transform readers the fold needs. Konva's nodes satisfy this, and
 * so does anything else that can report a transform: picking the
 * getters off Konva.Node instead drags in its setter overloads, which
 * makes the type impossible to satisfy by hand.
 */
export interface NodeTransform {
	x(): number
	y(): number
	scaleX(): number
	scaleY(): number
	rotation(): number
}

export interface Selection {
	/**
	 * Re-bind to the scene after it reconciled: a changed annotation is
	 * rendered by a new node, and the transformer has to follow it.
	 */
	sync(): void
	detach(): void
}

/**
 * Map a flat point list through the node's transform, in Konva's
 * application order: scale, then rotation, then translation.
 *
 * @param points flat [x1, y1, …] list
 * @param node the transformed Konva node
 */
function transformPoints(points: number[], node: NodeTransform): number[] {
	const radians = (node.rotation() * Math.PI) / 180
	const cos = Math.cos(radians)
	const sin = Math.sin(radians)
	const result: number[] = []
	for (let i = 0; i < points.length; i += 2) {
		const x = points[i]! * node.scaleX()
		const y = points[i + 1]! * node.scaleY()
		result.push(node.x() + x * cos - y * sin, node.y() + x * sin + y * cos)
	}
	return result
}

/**
 * Fold the node transform applied by dragging or the transformer handles
 * back into the annotation data, so the node itself stays untransformed.
 *
 * @param annotation the annotation to update
 * @param node its Konva node after the interaction
 */
export function applyNodeTransform(annotation: Annotation, node: NodeTransform): Annotation {
	switch (annotation.type) {
		case 'draw':
		case 'arrow': {
			// Scale and rotation fold into the point list itself, so the
			// annotation needs no transform fields of its own
			const points = transformPoints(annotation.points, node)
			const scale = (Math.abs(node.scaleX()) + Math.abs(node.scaleY())) / 2
			const strokeWidth = Math.max(1, annotation.strokeWidth * scale)
			return { ...annotation, points, strokeWidth } as Annotation
		}
		case 'redact':
			return {
				...annotation,
				rect: {
					x: node.x(),
					y: node.y(),
					width: Math.max(1, annotation.rect.width * node.scaleX()),
					height: Math.max(1, annotation.rect.height * node.scaleY()),
				},
			}
		case 'rectangle':
		case 'ellipse':
			// Both shapes anchor at the rect's top-left (the ellipse via
			// its negative offset), so the fold is identical
			return {
				...annotation,
				rect: {
					x: node.x(),
					y: node.y(),
					width: Math.max(1, annotation.rect.width * node.scaleX()),
					height: Math.max(1, annotation.rect.height * node.scaleY()),
				},
				rotation: node.rotation(),
			}
		case 'text':
		case 'sticker':
			return {
				...annotation,
				x: node.x(),
				y: node.y(),
				fontSize: Math.max(4, annotation.fontSize * node.scaleY()),
				rotation: node.rotation(),
			}
	}
}

/**
 * Attach click-to-select, drag and transform behavior for annotation
 * nodes.
 *
 * @param deps stage access and state callbacks
 */
export function attachSelection(deps: SelectionDeps): Selection {
	const accent = primaryColor()
	const transformer = new Konva.Transformer({
		rotateEnabled: true,
		flipEnabled: false,
		ignoreStroke: true,
		// A plain square with four corner handles
		enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
		anchorSize: 12,
		anchorCornerRadius: 6,
		anchorFill: '#fff',
		anchorStroke: accent,
		borderStroke: accent,
		rotateAnchorOffset: 24,
		rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315],
		rotationSnapTolerance: 6,
	})
	const layer = new Konva.Layer({ name: 'selection' })
	layer.add(transformer)
	deps.stage.add(layer)

	const findAnnotation = (id: string): Annotation | undefined => deps.getState().annotations.find((annotation) => annotation.id === id)

	// Konva id selectors match literally, and CSS.escape would mangle
	// UUIDs starting with a digit, so compare ids directly
	const findNode = (id: string | null) => id === null ? null : deps.stage.find('.annotation').find((node) => node.id() === id) ?? null

	const reportRect = () => {
		const node = findNode(deps.getSelectedId())
		deps.onSelectionRect(node ? node.getClientRect() : null)
	}

	const syncTransformer = () => {
		const id = deps.getSelectedId()
		const node = findNode(id)
		if (node === null || node === undefined) {
			transformer.nodes([])
			deps.onSelectionRect(null)
			return
		}
		const annotation = findAnnotation(id!)
		// Every annotation resizes; freehand and arrow fold scale and
		// rotation into their point lists. Redactions stay axis-aligned:
		// their pixel sampling has no notion of an angle.
		transformer.rotateEnabled(annotation !== undefined && annotation.type !== 'redact')
		transformer.nodes([node])
		deps.onSelectionRect(node.getClientRect())
	}

	const sync = () => {
		deps.stage.find('.annotation').forEach((node) => node.draggable(true))
		syncTransformer()
	}
	sync()

	const onWriteBack = (event: Konva.KonvaEventObject<Event>) => {
		const node = event.target
		const annotation = findAnnotation(node.id())
		if (annotation === undefined) {
			return
		}
		const state = deps.getState()
		deps.commit({
			...state,
			annotations: state.annotations.map((entry) => entry.id === annotation.id ? applyNodeTransform(annotation, node) : entry),
		})
	}

	const onClick = (event: Konva.KonvaEventObject<MouseEvent>) => {
		if (event.target.hasName('annotation')) {
			deps.select(event.target.id())
		} else if (event.target === deps.stage || event.target instanceof Konva.Image) {
			deps.select(null)
		}
		syncTransformer()
	}

	const onDblClick = (event: Konva.KonvaEventObject<MouseEvent>) => {
		const annotation = findAnnotation(event.target.id())
		if (annotation?.type === 'text') {
			deps.editText(annotation)
		}
	}

	deps.stage.on('click.selection tap.selection', onClick)
	deps.stage.on('dblclick.selection dbltap.selection', onDblClick)
	deps.stage.on('dragend.selection transformend.selection', onWriteBack)
	deps.stage.on('dragmove.selection transform.selection', reportRect)

	return {
		sync,
		detach() {
			deps.stage.off('.selection')
			deps.stage.find('.annotation').forEach((node) => node.draggable(false))
			deps.onSelectionRect(null)
			transformer.destroy()
			layer.destroy()
		},
	}
}
