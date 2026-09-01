/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Ref } from 'vue'
import type { EditorContext } from '../editor/context.ts'
import type { SceneOptions } from '../editor/render.ts'
import type { TextAnnotation } from '../editor/state.ts'

import { ref } from 'vue'
import { visibleRect } from '../editor/render.ts'

export interface TextEdit {
	sceneX: number
	sceneY: number
	screenX: number
	screenY: number
	screenFontSize: number
	color: string
	value: string
	/** Existing annotation being edited, null when creating */
	id: string | null
}

export interface TextEditingDeps {
	context: EditorContext
	/** The current view transform, null before the first render */
	viewOptions(): SceneOptions | null
	/** The orientation-baked source canvas */
	oriented(): HTMLCanvasElement | null
}

export interface TextEditing {
	textEdit: Ref<TextEdit | null>
	/**
	 * Open the text overlay at a scene position, optionally editing an
	 * existing annotation.
	 *
	 * @param position scene coordinates of the text anchor
	 * @param position.x horizontal scene coordinate
	 * @param position.y vertical scene coordinate
	 * @param existing annotation to edit instead of creating one
	 */
	startTextEdit(position: { x: number, y: number }, existing?: TextAnnotation): void
	/**
	 * Commit the text overlay content into the state.
	 *
	 * @param text the entered text
	 */
	confirmTextEdit(text: string): void
}

/**
 * The floating text overlay's state and lifecycle: opening it at the
 * right screen position and folding the entered text back into the
 * annotations.
 *
 * @param deps context plus view accessors
 */
export function useTextEditing(deps: TextEditingDeps): TextEditing {
	const { context } = deps
	const textEdit = ref<TextEdit | null>(null)

	/**
	 * Open the overlay at a scene position.
	 *
	 * @param position scene coordinates of the text anchor
	 * @param position.x horizontal scene coordinate
	 * @param position.y vertical scene coordinate
	 * @param existing annotation to edit instead of creating one
	 */
	function startTextEdit(position: { x: number, y: number }, existing?: TextAnnotation): void {
		const options = deps.viewOptions()
		const oriented = deps.oriented()
		if (options === null || oriented === null) {
			return
		}
		const origin = options.showCropped
			? visibleRect(context.state.value, { width: oriented.width, height: oriented.height })
			: { x: 0, y: 0 }
		textEdit.value = {
			sceneX: position.x,
			sceneY: position.y,
			screenX: options.offset.x + (position.x - origin.x) * options.scale,
			screenY: options.offset.y + (position.y - origin.y) * options.scale,
			screenFontSize: (existing?.fontSize ?? context.fontSize.value) * options.scale,
			color: existing?.color ?? context.drawColor.value,
			value: existing?.text ?? '',
			id: existing?.id ?? null,
		}
	}

	/**
	 * Fold the entered text back into the annotations.
	 *
	 * @param text the entered text
	 */
	function confirmTextEdit(text: string): void {
		const edit = textEdit.value
		textEdit.value = null
		if (edit === null) {
			return
		}
		const state = context.state.value
		const trimmed = text.trim()

		if (edit.id !== null) {
			context.commit({
				...state,
				annotations: trimmed === ''
					? state.annotations.filter((annotation) => annotation.id !== edit.id)
					: state.annotations.map((annotation) => annotation.id === edit.id ? { ...annotation, text: trimmed } : annotation),
			})
		} else if (trimmed !== '') {
			context.commit({
				...state,
				annotations: [...state.annotations, {
					id: crypto.randomUUID(),
					type: 'text',
					x: edit.sceneX,
					y: edit.sceneY,
					text: trimmed,
					color: edit.color,
					fontSize: context.fontSize.value,
					rotation: 0,
				}],
			})
		}
	}

	return { textEdit, startTextEdit, confirmTextEdit }
}
