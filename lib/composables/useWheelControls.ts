/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Ref } from 'vue'
import type { EditorContext } from '../editor/context.ts'

import { onBeforeUnmount, onMounted } from 'vue'

/**
 * View gestures on the canvas: ctrl/cmd + wheel zooms, a plain wheel
 * pans while zoomed, and dragging pans in the modes without a canvas
 * tool (adjust/filter) so it cannot fight annotation dragging.
 *
 * @param element the canvas container
 * @param context the editor context holding the view state
 */
export function useWheelControls(element: Ref<HTMLElement | null>, context: EditorContext): void {
	let dragFrom: { x: number, y: number, panX: number, panY: number } | null = null

	const pannable = () => context.activeTool.value === 'adjust' && context.viewZoom.value > 1

	/**
	 * @param event the pointer event
	 */
	function onPointerDown(event: PointerEvent): void {
		if (!pannable() || event.button !== 0) {
			return
		}
		dragFrom = {
			x: event.clientX,
			y: event.clientY,
			panX: context.viewPan.value.x,
			panY: context.viewPan.value.y,
		}
		element.value?.setPointerCapture(event.pointerId)
	}

	/**
	 * @param event the pointer event
	 */
	function onPointerMove(event: PointerEvent): void {
		if (dragFrom === null) {
			return
		}
		context.viewPan.value = {
			x: dragFrom.panX + (event.clientX - dragFrom.x),
			y: dragFrom.panY + (event.clientY - dragFrom.y),
		}
	}

	/**
	 *
	 */
	function onPointerUp(): void {
		dragFrom = null
	}

	/**
	 * @param event the wheel event
	 */
	function onWheel(event: WheelEvent): void {
		if (event.ctrlKey || event.metaKey) {
			event.preventDefault()
			const next = context.viewZoom.value * (event.deltaY < 0 ? 1.1 : 1 / 1.1)
			context.viewZoom.value = next < 1.05 ? 1 : Math.min(4, next)
			if (context.viewZoom.value === 1) {
				context.viewPan.value = { x: 0, y: 0 }
			}
		} else if (context.viewZoom.value > 1) {
			event.preventDefault()
			const pan = context.viewPan.value
			context.viewPan.value = { x: pan.x - event.deltaX, y: pan.y - event.deltaY }
		}
	}

	onMounted(() => {
		const target = element.value
		target?.addEventListener('wheel', onWheel, { passive: false })
		target?.addEventListener('pointerdown', onPointerDown)
		target?.addEventListener('pointermove', onPointerMove)
		target?.addEventListener('pointerup', onPointerUp)
		target?.addEventListener('pointercancel', onPointerUp)
	})
	onBeforeUnmount(() => {
		const target = element.value
		target?.removeEventListener('wheel', onWheel)
		target?.removeEventListener('pointerdown', onPointerDown)
		target?.removeEventListener('pointermove', onPointerMove)
		target?.removeEventListener('pointerup', onPointerUp)
		target?.removeEventListener('pointercancel', onPointerUp)
	})
}
