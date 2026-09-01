/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { ComputedRef, InjectionKey, ShallowRef } from 'vue'
import type { EditorState } from './state.ts'

import { inject, provide, shallowRef } from 'vue'
import { useHistory } from '../composables/useHistory.ts'
import { createInitialState } from './state.ts'

export type Tool
	= | 'select'
		| 'crop'
		| 'adjust'
		| 'draw'
		| 'rectangle'
		| 'ellipse'
		| 'arrow'
		| 'text'
		| 'sticker'

export interface EditorContext {
	state: Readonly<ShallowRef<EditorState>>
	activeTool: ShallowRef<Tool>
	/** Stroke and text color for new annotations */
	drawColor: ShallowRef<string>
	/** Stroke width for new annotations */
	strokeWidth: ShallowRef<number>
	/** Font size for new text annotations */
	fontSize: ShallowRef<number>
	/** Emoji placed by the sticker tool */
	sticker: ShallowRef<string>
	/** Id of the annotation selected in select mode */
	selectedId: ShallowRef<string | null>
	canUndo: ComputedRef<boolean>
	canRedo: ComputedRef<boolean>
	/** Apply a new state and record it as an undoable step */
	commit(next: EditorState): void
	/** Apply a new state without recording it (live slider previews) */
	preview(next: EditorState): void
	undo(): void
	redo(): void
	/** Reset to a fresh state and empty history, e.g. when the source changes */
	reset(): void
}

const EDITOR_CONTEXT: InjectionKey<EditorContext> = Symbol('nextcloud:image-editor')

/**
 * Create the shared editor context and provide it to descendants.
 */
export function createEditorContext(): EditorContext {
	const history = useHistory<EditorState>()
	const state = shallowRef(createInitialState())
	const activeTool = shallowRef<Tool>('select')
	history.push(structuredClone(state.value))

	const context: EditorContext = {
		state,
		activeTool,
		drawColor: shallowRef('#ff0000'),
		strokeWidth: shallowRef(6),
		fontSize: shallowRef(24),
		sticker: shallowRef('😀'),
		selectedId: shallowRef<string | null>(null),
		canUndo: history.canUndo,
		canRedo: history.canRedo,
		commit(next) {
			state.value = next
			history.push(structuredClone(next))
		},
		preview(next) {
			state.value = next
		},
		undo() {
			const snapshot = history.undo()
			if (snapshot !== undefined) {
				state.value = structuredClone(snapshot)
			}
		},
		redo() {
			const snapshot = history.redo()
			if (snapshot !== undefined) {
				state.value = structuredClone(snapshot)
			}
		},
		reset() {
			history.clear()
			state.value = createInitialState()
			activeTool.value = 'select'
			context.selectedId.value = null
			history.push(structuredClone(state.value))
		},
	}

	provide(EDITOR_CONTEXT, context)
	return context
}

/**
 * Access the editor context provided by the ImageEditor root.
 */
export function useEditorContext(): EditorContext {
	const context = inject(EDITOR_CONTEXT, null)
	if (context === null) {
		throw new Error('useEditorContext() called outside of an ImageEditor tree')
	}
	return context
}
