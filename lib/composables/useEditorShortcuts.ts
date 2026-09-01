/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { EditorContext } from '../editor/context.ts'

import { onBeforeUnmount, onMounted } from 'vue'
import { translateAnnotation } from '../editor/state.ts'

export interface ShortcutDeps {
	context: EditorContext
	/** Whether the text overlay currently captures the keyboard */
	isTextEditing(): boolean
	/** Delete the selected annotation */
	onDelete(): void
	/** Escape pressed with nothing else to dismiss */
	onEscape(): void
}

const NUDGE_KEYS: Record<string, [number, number]> = {
	ArrowLeft: [-1, 0],
	ArrowRight: [1, 0],
	ArrowUp: [0, -1],
	ArrowDown: [0, 1],
}

/**
 * Global editor shortcuts: undo/redo, delete, escape and arrow-key
 * nudging of the selection. Nudges preview live and commit once on key
 * release, so holding a key stays a single undo step.
 *
 * @param deps context and editor callbacks
 */
export function useEditorShortcuts(deps: ShortcutDeps): void {
	const { context } = deps
	let nudging = false

	/**
	 * Move the selected annotation with the arrow keys.
	 *
	 * @param event the keyboard event
	 */
	function nudgeSelection(event: KeyboardEvent): void {
		const id = context.selectedId.value
		const direction = NUDGE_KEYS[event.key]
		if (id === null || direction === undefined) {
			return
		}
		event.preventDefault()
		const step = event.shiftKey ? 10 : 1
		const state = context.state.value
		nudging = true
		context.preview({
			...state,
			annotations: state.annotations.map((annotation) => annotation.id === id
				? translateAnnotation(annotation, direction[0] * step, direction[1] * step)
				: annotation),
		})
	}

	/**
	 * Undo/redo, nudge, delete and escape handling.
	 *
	 * @param event the keyboard event
	 */
	function onKeydown(event: KeyboardEvent): void {
		if (deps.isTextEditing()) {
			return
		}
		const meta = event.ctrlKey || event.metaKey
		if (meta && !event.shiftKey && event.key.toLowerCase() === 'z') {
			event.preventDefault()
			context.undo()
			return
		}
		if ((meta && event.shiftKey && event.key.toLowerCase() === 'z')
			|| (meta && event.key.toLowerCase() === 'y')) {
			event.preventDefault()
			context.redo()
			return
		}
		if (event.key in NUDGE_KEYS && context.selectedId.value !== null) {
			nudgeSelection(event)
			return
		}
		if ((event.key === 'Delete' || event.key === 'Backspace') && context.selectedId.value !== null) {
			event.preventDefault()
			deps.onDelete()
		} else if (event.key === 'Escape') {
			deps.onEscape()
		}
	}

	/**
	 * Commit a finished nudge as a single undo step.
	 *
	 * @param event the keyboard event
	 */
	function onKeyup(event: KeyboardEvent): void {
		if (nudging && event.key in NUDGE_KEYS) {
			nudging = false
			context.commit(context.state.value)
		}
	}

	onMounted(() => {
		window.addEventListener('keydown', onKeydown)
		window.addEventListener('keyup', onKeyup)
	})
	onBeforeUnmount(() => {
		window.removeEventListener('keydown', onKeydown)
		window.removeEventListener('keyup', onKeyup)
	})
}
