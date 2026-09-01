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
		| 'redact'

/** Top-level editor sections, presented as sidebar tabs */
export type EditorMode = 'crop' | 'finetune' | 'filter' | 'annotate' | 'sticker' | 'redact'

/** The canvas tool each mode starts with */
export const MODE_DEFAULT_TOOL: Record<EditorMode, Tool> = {
	crop: 'crop',
	finetune: 'adjust',
	filter: 'adjust',
	annotate: 'select',
	sticker: 'sticker',
	redact: 'redact',
}

export interface EditorContext {
	state: Readonly<ShallowRef<EditorState>>
	/** Active sidebar section */
	activeMode: ShallowRef<EditorMode>
	activeTool: ShallowRef<Tool>
	/** Switch section and select its default canvas tool */
	setMode(mode: EditorMode): void
	/** Stroke and text color for new annotations */
	drawColor: ShallowRef<string>
	/** Stroke width for new annotations */
	strokeWidth: ShallowRef<number>
	/** Font size for new text annotations */
	fontSize: ShallowRef<number>
	/** Emoji placed by the sticker tool */
	sticker: ShallowRef<string>
	/** Obfuscation style used by new redactions */
	redactStyle: ShallowRef<'pixelate' | 'blur'>
	/** View-only magnification of the canvas, 1 = fit */
	viewZoom: ShallowRef<number>
	/** View-only pan offset in stage pixels, only meaningful when zoomed */
	viewPan: ShallowRef<{ x: number, y: number }>
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
	const activeMode = shallowRef<EditorMode>('crop')
	const activeTool = shallowRef<Tool>(MODE_DEFAULT_TOOL.crop)
	history.push(structuredClone(state.value))

	const context: EditorContext = {
		state,
		activeMode,
		activeTool,
		setMode(mode) {
			activeMode.value = mode
			activeTool.value = MODE_DEFAULT_TOOL[mode]
			context.selectedId.value = null
		},
		drawColor: shallowRef('#ff0000'),
		strokeWidth: shallowRef(6),
		fontSize: shallowRef(24),
		sticker: shallowRef('😀'),
		redactStyle: shallowRef<'pixelate' | 'blur'>('pixelate'),
		viewZoom: shallowRef(1),
		viewPan: shallowRef({ x: 0, y: 0 }),
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
			activeMode.value = 'crop'
			activeTool.value = MODE_DEFAULT_TOOL.crop
			context.selectedId.value = null
			context.viewZoom.value = 1
			context.viewPan.value = { x: 0, y: 0 }
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
