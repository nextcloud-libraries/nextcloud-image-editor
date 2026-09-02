/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { EditorContext } from '../lib/editor/context.ts'

import { describe, expect, it } from 'vitest'
import { createApp, defineComponent, h } from 'vue'
import { createEditorContext, useEditorContext } from '../lib/editor/context.ts'
import { createInitialState } from '../lib/editor/state.ts'
import { MAX_ZOOM, MIN_ZOOM, panBounds, VIEW_MARGIN } from '../lib/editor/view.ts'

function setupContext(): { context: EditorContext, injected: EditorContext } {
	let context!: EditorContext
	let injected!: EditorContext

	const Child = defineComponent({
		setup() {
			injected = useEditorContext()
			return () => null
		},
	})
	const Root = defineComponent({
		setup() {
			context = createEditorContext()
			return () => h(Child)
		},
	})
	createApp(Root).mount(document.createElement('div'))
	return { context, injected }
}

describe('createEditorContext', () => {
	it('provides the context to descendants', () => {
		const { context, injected } = setupContext()
		expect(injected).toBe(context)
	})

	it('starts with a pristine state and no undo steps', () => {
		const { context } = setupContext()
		expect(context.state.value.rotation).toBe(0)
		expect(context.state.value.annotations).toEqual([])
		expect(context.canUndo.value).toBe(false)
		expect(context.canRedo.value).toBe(false)
	})

	it('commit records an undoable step', () => {
		const { context } = setupContext()
		context.commit({ ...context.state.value, rotation: 90 })
		expect(context.state.value.rotation).toBe(90)
		expect(context.canUndo.value).toBe(true)

		context.undo()
		expect(context.state.value.rotation).toBe(0)
		expect(context.canRedo.value).toBe(true)

		context.redo()
		expect(context.state.value.rotation).toBe(90)
	})

	it('preview changes state without recording history', () => {
		const { context } = setupContext()
		context.preview({ ...context.state.value, rotation: 90 })
		expect(context.state.value.rotation).toBe(90)
		expect(context.canUndo.value).toBe(false)
	})

	it('undo returns deep copies so stored snapshots stay intact', () => {
		const { context } = setupContext()
		context.commit({ ...context.state.value, adjustments: { brightness: 50, contrast: 0, saturation: 0 } })
		context.undo()
		context.state.value.adjustments.brightness = 99
		context.redo()
		expect(context.state.value.adjustments.brightness).toBe(50)
	})

	it('reset clears state, history, mode and tool', () => {
		const { context } = setupContext()
		context.setMode('annotate')
		context.activeTool.value = 'draw'
		context.commit({ ...context.state.value, rotation: 90 })
		context.reset()

		expect(context.state.value.rotation).toBe(0)
		expect(context.activeMode.value).toBe('crop')
		expect(context.activeTool.value).toBe('crop')
		expect(context.canUndo.value).toBe(false)
		expect(context.canRedo.value).toBe(false)
	})

	it('setMode selects the default tool and drops the selection', () => {
		const { context } = setupContext()
		context.selectedId.value = 'some-id'

		context.setMode('annotate')
		expect(context.activeTool.value).toBe('draw')
		expect(context.selectedId.value).toBeNull()

		context.setMode('select')
		expect(context.activeTool.value).toBe('select')

		context.setMode('finetune')
		expect(context.activeTool.value).toBe('adjust')

		context.setMode('sticker')
		expect(context.activeTool.value).toBe('sticker')
	})
})

describe('reset', () => {
	it('starts over from a pristine state by default', () => {
		const { context } = setupContext()
		context.commit({ ...context.state.value, rotation: 90 })
		context.reset()

		expect(context.state.value.rotation).toBe(0)
		expect(context.canUndo.value).toBe(false)
		expect(context.historyEntries.value).toHaveLength(1)
	})

	it('starts over from a state it is handed', () => {
		const { context } = setupContext()
		const restored = { ...createInitialState(), rotation: 180 as const, preset: 'noir' as const }
		context.reset(restored)

		expect(context.state.value).toBe(restored)
		// The starting point of a resumed session, with nothing to undo
		expect(context.canUndo.value).toBe(false)
		expect(context.historyEntries.value).toHaveLength(1)
		expect(context.historyEntries.value[0]!.snapshot).toBe(restored)
	})

	it('names the starting point after where it came from', () => {
		const fresh = setupContext().context
		fresh.reset()
		const seeded = setupContext().context
		seeded.reset(createInitialState())

		expect(fresh.historyEntries.value[0]!.label)
			.not.toBe(seeded.historyEntries.value[0]!.label)
	})
})

describe('view zoom and pan', () => {
	const VISIBLE = { x: 0, y: 0, width: 1000, height: 1000 }
	const CONTAINER = { width: 500, height: 500 }
	// The scale the editor publishes: the visible area fitted into the
	// container minus the stage margin, so at zoom 1 there is by
	// definition nothing to pan
	const FIT_SCALE = (CONTAINER.width - VIEW_MARGIN * 2) / VISIBLE.width

	/**
	 * Publish a fit matching what the editor component computes.
	 *
	 * @param context the editor context to publish the fit on
	 */
	function publishFit(context: EditorContext): void {
		context.viewFit.value = {
			scale: FIT_SCALE,
			visible: VISIBLE,
			container: CONTAINER,
			showCropped: true,
		}
	}

	it('clamps the zoom to the allowed range', () => {
		const { context } = setupContext()
		context.setViewZoom(99)
		expect(context.viewZoom.value).toBe(MAX_ZOOM)
	})

	it('snaps a near-fitted zoom back to fit and recenters', () => {
		const { context } = setupContext()
		publishFit(context)
		context.setViewZoom(2)
		context.setViewPan({ x: 100, y: 100 })
		expect(context.viewPan.value).not.toEqual({ x: 0, y: 0 })

		context.setViewZoom(1.02)
		expect(context.viewZoom.value).toBe(MIN_ZOOM)
		expect(context.viewPan.value).toEqual({ x: 0, y: 0 })
	})

	it('refuses to pan the fitted view', () => {
		const { context } = setupContext()
		publishFit(context)
		context.setViewPan({ x: 300, y: 300 })
		expect(context.viewPan.value).toEqual({ x: 0, y: 0 })
	})

	it('stores a clamped offset so an overshoot cannot pile up', () => {
		const { context } = setupContext()
		publishFit(context)
		context.setViewZoom(2)
		const bounds = panBounds(VISIBLE, FIT_SCALE * 2, CONTAINER)

		// A wheel or a drag pushing far past the edge repeatedly used to
		// keep accumulating, which left the view unable to move until the
		// whole overshoot had been scrubbed back
		context.setViewPan({ x: 100000, y: 100000 })
		context.setViewPan({ x: 100000, y: 100000 })
		expect(context.viewPan.value).toEqual(bounds)

		// One step back has to move the view immediately
		context.setViewPan({ x: bounds.x - 10, y: bounds.y - 10 })
		expect(context.viewPan.value.x).toBe(bounds.x - 10)
	})

	it('keeps the anchor fixed while zooming at a point', () => {
		const { context } = setupContext()
		publishFit(context)
		context.setViewZoom(2, { x: 0, y: 0 })
		expect(context.viewPan.value).toEqual({ x: 0, y: 0 })

		context.setViewZoom(4, { x: 50, y: 0 })
		expect(context.viewPan.value.x).toBe(-50)
	})

	it('cannot pan without a published fit', () => {
		const { context } = setupContext()
		context.setViewZoom(2)
		context.setViewPan({ x: 50, y: 50 })
		expect(context.viewPan.value).toEqual({ x: 0, y: 0 })
	})

	it('clears the pan state on reset', () => {
		const { context } = setupContext()
		publishFit(context)
		context.setViewZoom(3)
		context.setViewPan({ x: 40, y: 40 })
		context.panning.value = true

		context.reset()
		expect(context.viewZoom.value).toBe(MIN_ZOOM)
		expect(context.viewPan.value).toEqual({ x: 0, y: 0 })
		expect(context.panning.value).toBe(false)
	})
})

describe('useEditorContext', () => {
	it('throws outside of an editor tree', () => {
		const Orphan = defineComponent({
			setup() {
				expect(() => useEditorContext()).toThrow()
				return () => null
			},
		})
		createApp(Orphan).mount(document.createElement('div'))
	})
})
