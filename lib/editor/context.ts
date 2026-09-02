/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { ComputedRef, InjectionKey, ShallowRef } from 'vue'
import type { HistoryEntry } from '../composables/useHistory.ts'
import type { EditorState } from './state.ts'
import type { Point, ViewFit } from './view.ts'

import { inject, provide, shallowRef, watch } from 'vue'
import { useHistory } from '../composables/useHistory.ts'
import { t } from '../utils/l10n.ts'
import { createInitialState } from './state.ts'
import { anchoredPan, clampPan, clampZoom, MIN_ZOOM, panBounds } from './view.ts'

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
	viewPan: ShallowRef<Point>
	/**
	 * Fit metrics of the rendered view, published by the editor
	 * component. The view setters clamp against these, so panning stops
	 * exactly where the renderer stops following it.
	 */
	viewFit: ShallowRef<ViewFit | null>
	/**
	 * True while a pan gesture owns the pointer, so canvas tools stay
	 * out of the way
	 */
	panning: ShallowRef<boolean>
	/**
	 * Magnify the view, optionally keeping a point fixed.
	 *
	 * @param zoom the requested factor, clamped to the allowed range
	 * @param anchor point to keep fixed, relative to the view center
	 */
	setViewZoom(zoom: number, anchor?: Point): void
	/**
	 * Pan the view, clamped so the content cannot leave the container.
	 *
	 * @param pan the requested offset in stage pixels
	 */
	setViewPan(pan: Point): void
	/** True between preview() and the next commit: a slider is scrubbing */
	interacting: ShallowRef<boolean>
	/** Id of the annotation selected in select mode */
	selectedId: ShallowRef<string | null>
	canUndo: ComputedRef<boolean>
	canRedo: ComputedRef<boolean>
	/** Every recorded step, oldest first, for a history list */
	historyEntries: ComputedRef<readonly HistoryEntry<EditorState>[]>
	/** Position of the state on screen within historyEntries */
	historyIndex: ComputedRef<number>
	/**
	 * Apply a new state and record it as an undoable step.
	 *
	 * @param next the state to apply
	 * @param label what the user did, translated, for the history list
	 */
	commit(next: EditorState, label?: string): void
	/** Apply a new state without recording it (live slider previews) */
	preview(next: EditorState): void
	undo(): void
	redo(): void
	/**
	 * Go to an arbitrary recorded step.
	 *
	 * @param index position in historyEntries
	 */
	jumpTo(index: number): void
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
	const viewZoom = shallowRef(MIN_ZOOM)
	const viewPan = shallowRef<Point>({ x: 0, y: 0 })
	const viewFit = shallowRef<ViewFit | null>(null)
	/**
	 * How far the view may be panned at the given zoom. Clamping on
	 * write is what keeps a pan gesture from accumulating an offset the
	 * renderer will not follow, which used to leave the view stuck
	 * until the overshoot was scrubbed back.
	 *
	 * @param zoom the zoom the pan applies to
	 */
	const boundsAt = (zoom: number): Point => {
		const fit = viewFit.value
		return fit === null
			? { x: 0, y: 0 }
			: panBounds(fit.visible, fit.scale * zoom, fit.container)
	}
	const activeMode = shallowRef<EditorMode>('crop')
	const activeTool = shallowRef<Tool>(MODE_DEFAULT_TOOL.crop)
	// Pushed by reference: every edit path builds new objects rather
	// than mutating, so a snapshot is already frozen in practice, and
	// keeping the identities lets the renderer skip the annotations an
	// undo did not touch
	history.push(state.value, t('Original'))

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
		viewZoom,
		viewPan,
		viewFit,
		panning: shallowRef(false),
		setViewZoom(zoom, anchor) {
			const previous = viewZoom.value
			const next = clampZoom(zoom)
			viewZoom.value = next
			if (next === MIN_ZOOM) {
				// The fitted view is centered by definition
				viewPan.value = { x: 0, y: 0 }
				return
			}
			const panned = anchor === undefined
				? viewPan.value
				: anchoredPan(viewPan.value, anchor, next / previous)
			viewPan.value = clampPan(panned, boundsAt(next))
		},
		setViewPan(pan) {
			viewPan.value = clampPan(pan, boundsAt(viewZoom.value))
		},
		interacting: shallowRef(false),
		selectedId: shallowRef<string | null>(null),
		canUndo: history.canUndo,
		canRedo: history.canRedo,
		historyEntries: history.entries,
		historyIndex: history.index,
		commit(next, label) {
			context.interacting.value = false
			state.value = next
			history.push(next, label)
		},
		preview(next) {
			context.interacting.value = true
			state.value = next
		},
		undo() {
			const snapshot = history.undo()
			if (snapshot !== undefined) {
				state.value = snapshot
			}
		},
		redo() {
			const snapshot = history.redo()
			if (snapshot !== undefined) {
				state.value = snapshot
			}
		},
		jumpTo(index) {
			const snapshot = history.jumpTo(index)
			if (snapshot !== undefined) {
				state.value = snapshot
			}
		},
		reset() {
			history.clear()
			state.value = createInitialState()
			activeMode.value = 'crop'
			activeTool.value = MODE_DEFAULT_TOOL.crop
			context.selectedId.value = null
			viewZoom.value = MIN_ZOOM
			viewPan.value = { x: 0, y: 0 }
			context.panning.value = false
			history.push(state.value, t('Original'))
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
