/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { EditorContext } from '../editor/context.ts'

export interface AnnotationColor {
	/**
	 * Follow the color control while it is being dragged: the selected
	 * annotation changes color without recording a step.
	 *
	 * @param color the color under the pointer
	 */
	preview(color: string): void
	/**
	 * Record the color the user settled on as one undoable step.
	 *
	 * @param color the chosen color
	 */
	commit(color: string): void
}

/**
 * The stroke and text color, and its effect on the current selection.
 *
 * A native color input reports every color the pointer passes over, so
 * committing each one buried the undo history under dozens of steps
 * for a single pick. The intermediate colors are previewed and only
 * the released one is recorded, which is how the sliders already
 * behave.
 *
 * @param context the editor context
 */
export function useAnnotationColor(context: EditorContext): AnnotationColor {
	/**
	 * The selected annotation, if its color is the user's to change.
	 * Stickers render an emoji glyph and redactions destroy pixels, so
	 * neither has a color worth writing.
	 */
	function recolorable() {
		const annotation = context.state.value.annotations
			.find((entry) => entry.id === context.selectedId.value)
		return annotation !== undefined
			&& 'color' in annotation
			&& annotation.type !== 'sticker'
			? annotation
			: undefined
	}

	/**
	 * @param color the color to apply to the selection
	 */
	function apply(color: string): void {
		const annotation = recolorable()
		if (annotation === undefined || annotation.color === color) {
			return
		}
		const state = context.state.value
		context.preview({
			...state,
			annotations: state.annotations.map((entry) => entry.id === annotation.id ? { ...entry, color } : entry),
		})
	}

	return {
		preview(color) {
			context.drawColor.value = color
			apply(color)
		},
		commit(color) {
			context.drawColor.value = color
			apply(color)
			// Nothing to record where the color only affects the next
			// annotation the user draws
			if (recolorable() !== undefined) {
				context.commit(context.state.value)
			}
		},
	}
}
