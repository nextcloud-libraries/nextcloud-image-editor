/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { EditorContext } from '../lib/editor/context.ts'

import { describe, expect, it } from 'vitest'
import { createApp, defineComponent, h } from 'vue'
import { createEditorContext, useEditorContext } from '../lib/editor/context.ts'

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

	it('reset clears state, history and tool', () => {
		const { context } = setupContext()
		context.activeTool.value = 'draw'
		context.commit({ ...context.state.value, rotation: 90 })
		context.reset()

		expect(context.state.value.rotation).toBe(0)
		expect(context.activeTool.value).toBe('select')
		expect(context.canUndo.value).toBe(false)
		expect(context.canRedo.value).toBe(false)
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
