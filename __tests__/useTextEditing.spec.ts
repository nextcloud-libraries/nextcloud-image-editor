/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { EditorContext } from '../lib/editor/context.ts'
import type { SceneOptions } from '../lib/editor/render.ts'
import type { TextAnnotation } from '../lib/editor/state.ts'

import { describe, expect, it } from 'vitest'
import { createApp, defineComponent } from 'vue'
import { useTextEditing } from '../lib/composables/useTextEditing.ts'
import { createEditorContext } from '../lib/editor/context.ts'

const VIEW: SceneOptions = {
	scale: 2,
	offset: { x: 40, y: 20 },
	showCropped: true,
}

/**
 * A text editing composable over a real editor context.
 *
 * @param view the view transform to report, null before a render
 */
function setup(view: SceneOptions | null = VIEW) {
	let context!: EditorContext
	let editing!: ReturnType<typeof useTextEditing>

	const Root = defineComponent({
		setup() {
			context = createEditorContext()
			editing = useTextEditing({
				context,
				viewOptions: () => view,
				// 200x100, as the deterministic fixture is
				oriented: () => ({ width: 200, height: 100 }) as HTMLCanvasElement,
			})
			return () => null
		},
	})
	createApp(Root).mount(document.createElement('div'))
	return { context, ...editing }
}

/**
 * The one text annotation in the state.
 *
 * @param context the editor context
 */
function text(context: EditorContext): TextAnnotation {
	return context.state.value.annotations[0] as TextAnnotation
}

describe('useTextEditing', () => {
	it('places the overlay where the scene point is on screen', () => {
		const { textEdit, startTextEdit } = setup()
		startTextEdit({ x: 30, y: 10 })

		// offset + scene * scale, with the font size scaled to match
		expect(textEdit.value).toMatchObject({
			sceneX: 30,
			sceneY: 10,
			screenX: 40 + 30 * 2,
			screenY: 20 + 10 * 2,
			id: null,
		})
	})

	it('accounts for the crop the view is showing', () => {
		const { context, textEdit, startTextEdit } = setup()
		context.commit({ ...context.state.value, crop: { x: 20, y: 5, width: 100, height: 50 } })
		startTextEdit({ x: 30, y: 10 })

		// The view origin is the crop corner, not the image corner
		expect(textEdit.value).toMatchObject({
			screenX: 40 + (30 - 20) * 2,
			screenY: 20 + (10 - 5) * 2,
		})
	})

	it('does nothing before the first render', () => {
		const { textEdit, startTextEdit } = setup(null)
		startTextEdit({ x: 30, y: 10 })
		expect(textEdit.value).toBeNull()
	})

	it('adds the text the user typed', () => {
		const { context, startTextEdit, confirmTextEdit } = setup()
		startTextEdit({ x: 30, y: 10 })
		confirmTextEdit('  Hello  ')

		expect(text(context)).toMatchObject({ type: 'text', text: 'Hello', x: 30, y: 10 })
		expect(context.canUndo.value).toBe(true)
	})

	it('adds nothing for text that is only whitespace', () => {
		const { context, startTextEdit, confirmTextEdit } = setup()
		startTextEdit({ x: 30, y: 10 })
		confirmTextEdit('   ')

		expect(context.state.value.annotations).toEqual([])
		expect(context.canUndo.value).toBe(false)
	})

	it('closes the overlay whether or not anything was added', () => {
		const { textEdit, startTextEdit, confirmTextEdit } = setup()
		startTextEdit({ x: 30, y: 10 })
		confirmTextEdit('')
		expect(textEdit.value).toBeNull()
	})

	it('edits an existing annotation in place', () => {
		const { context, startTextEdit, confirmTextEdit } = setup()
		startTextEdit({ x: 30, y: 10 })
		confirmTextEdit('First')
		const original = text(context)

		startTextEdit({ x: original.x, y: original.y }, original)
		confirmTextEdit('Second')

		expect(context.state.value.annotations).toHaveLength(1)
		expect(text(context)).toMatchObject({ id: original.id, text: 'Second' })
	})

	it('opens an existing annotation with its own size and colour', () => {
		const { context, textEdit, startTextEdit, confirmTextEdit } = setup()
		startTextEdit({ x: 30, y: 10 })
		confirmTextEdit('First')
		const original = { ...text(context), color: '#00ff00', fontSize: 30 }

		startTextEdit({ x: original.x, y: original.y }, original)

		expect(textEdit.value).toMatchObject({
			value: 'First',
			color: '#00ff00',
			screenFontSize: 30 * 2,
			id: original.id,
		})
	})

	it('deletes an annotation emptied of its text', () => {
		const { context, startTextEdit, confirmTextEdit } = setup()
		startTextEdit({ x: 30, y: 10 })
		confirmTextEdit('First')

		startTextEdit({ x: 30, y: 10 }, text(context))
		confirmTextEdit('   ')

		expect(context.state.value.annotations).toEqual([])
	})

	it('ignores a confirmation with no overlay open', () => {
		const { context, confirmTextEdit } = setup()
		confirmTextEdit('Nothing to confirm')
		expect(context.state.value.annotations).toEqual([])
	})
})
