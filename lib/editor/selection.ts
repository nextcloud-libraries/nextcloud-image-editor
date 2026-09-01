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
		case 'rectangle':
			return {
				...annotation,
				rect: {
					x: node.x(),
					y: node.y(),
					width: Math.max(1, annotation.rect.width * node.scaleX()),
					height: Math.max(1, annotation.rect.height * node.scaleY()),
				},
			}
		case 'ellipse': {
			const width = Math.max(1, annotation.rect.width * node.scaleX())
			const height = Math.max(1, annotation.rect.height * node.scaleY())
			// The ellipse node anchors at its center
			return { ...annotation, rect: { x: node.x() - width / 2, y: node.y() - height / 2, width, height } }
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
		anchorSize: 12,
		anchorCornerRadius: 6,
		anchorFill: '#fff',
		anchorStroke: accent,
		borderStroke: accent,
		rotateAnchorOffset: 24,
	})
	const layer = new Konva.Layer({ name: 'selection' })
	layer.add(transformer)
	deps.stage.add(layer)

	const findAnnotation = (id: string): Annotation | undefined => deps.getState().annotations.find((annotation) => annotation.id === id)

	const syncTransformer = () => {
		const id = deps.getSelectedId()
		const node = id === null ? null : deps.stage.findOne(`#${CSS.escape(id)}`)
		if (node === null || node === undefined) {
			transformer.nodes([])
			return
		}
		const annotation = findAnnotation(id!)
		// Freehand and arrow annotations only move; resizing them would
		// distort stroke geometry unpredictably
		const movableOnly = annotation?.type === 'draw' || annotation?.type === 'arrow'
		transformer.resizeEnabled(!movableOnly)
		transformer.rotateEnabled(!movableOnly)
		transformer.nodes([node])
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

	return () => {
		deps.stage.off('.selection')
		deps.stage.find('.annotation').forEach((node) => node.draggable(false))
		transformer.destroy()
		layer.destroy()
	}
}
