/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { ComputedRef, InjectionKey, ShallowRef } from 'vue'
import type { EditorState } from './state.ts'

import { inject, provide, shallowRef, watch } from 'vue'
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
export type EditorMode = 'select' | 'crop' | 'finetune' | 'filter' | 'annotate' | 'sticker' | 'redact'

/** The canvas tool each mode starts with */
export const MODE_DEFAULT_TOOL: Record<EditorMode, Tool> = {
	select: 'select',
	crop: 'crop',
	finetune: 'adjust',
	filter: 'adjust',
	annotate: 'draw',
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
	/** Crop aspect lock: width/height ratio, 'original', or null = free */
	cropAspect: ShallowRef<number | 'original' | null>
	/** View-only magnification of the canvas, 1 = fit */
	viewZoom: ShallowRef<number>
	/** View-only pan offset in stage pixels, only meaningful when zoomed */
	viewPan: ShallowRef<{ x: number, y: number }>
	/** True between preview() and the next commit: a slider is scrubbing */
	interacting: ShallowRef<boolean>
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
		cropAspect: shallowRef<number | 'original' | null>(null),
		viewZoom: shallowRef(1),
		viewPan: shallowRef({ x: 0, y: 0 }),
		interacting: shallowRef(false),
		selectedId: shallowRef<string | null>(null),
		canUndo: history.canUndo,
		canRedo: history.canRedo,
		commit(next) {
			context.interacting.value = false
			state.value = next
			history.push(structuredClone(next))
		},
		preview(next) {
			context.interacting.value = true
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

	// A selection is only visible and editable in the select tool;
	// keeping it across tool switches invites invisible deletions
	watch(activeTool, (tool) => {
		if (tool !== 'select') {
			context.selectedId.value = null
		}
	})

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
