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
 * Shift a flat point list by the given delta.
 *
 * @param points flat [x1, y1, …] list
 * @param dx horizontal shift
 * @param dy vertical shift
 */
function translatePoints(points: number[], dx: number, dy: number): number[] {
	return points.map((value, i) => (i % 2 === 0 ? value + dx : value + dy))
}

/**
 * Fold the node transform applied by dragging or the transformer handles
 * back into the annotation data, so the node itself stays untransformed.
 *
 * @param annotation the annotation to update
 * @param node its Konva node after the interaction
 */
function applyNodeTransform(annotation: Annotation, node: Konva.Node): Annotation {
	switch (annotation.type) {
		case 'draw':
		case 'arrow': {
			const points = translatePoints(annotation.points, node.x(), node.y())
			return { ...annotation, points } as Annotation
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
 * nodes. Returns a cleanup function.
 *
 * @param deps stage access and state callbacks
 */
export function attachSelection(deps: SelectionDeps): () => void {
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
		// Freehand and arrow annotations only move; resizing them would
		// distort stroke geometry unpredictably. Redactions stay
		// axis-aligned: their pixel sampling has no notion of an angle.
		const movableOnly = annotation?.type === 'draw' || annotation?.type === 'arrow'
		const rotatable = annotation !== undefined && 'rotation' in annotation && annotation.type !== 'redact'
		transformer.resizeEnabled(!movableOnly)
		transformer.rotateEnabled(rotatable)
		transformer.nodes([node])
		deps.onSelectionRect(node.getClientRect())
	}

	const makeDraggable = () => {
		deps.stage.find('.annotation').forEach((node) => node.draggable(true))
	}
	makeDraggable()
	syncTransformer()

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

	return () => {
		deps.stage.off('.selection')
		deps.stage.find('.annotation').forEach((node) => node.draggable(false))
		deps.onSelectionRect(null)
		transformer.destroy()
		layer.destroy()
	}
}
