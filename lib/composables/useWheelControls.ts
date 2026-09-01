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
	// Active touch points, for two-finger pinch zooming
	const pointers = new Map<number, { x: number, y: number }>()
	let pinchDistance: number | null = null

	const pannable = () => context.activeTool.value === 'adjust' && context.viewZoom.value > 1

	/**
	 * Distance between the two active pointers.
	 */
	function currentPinch(): number | null {
		if (pointers.size !== 2) {
			return null
		}
		const [a, b] = [...pointers.values()]
		return Math.hypot(a!.x - b!.x, a!.y - b!.y)
	}

	/**
	 * @param zoom the requested zoom factor
	 */
	function applyZoom(zoom: number): void {
		context.viewZoom.value = zoom < 1.05 ? 1 : Math.min(4, zoom)
		if (context.viewZoom.value === 1) {
			context.viewPan.value = { x: 0, y: 0 }
		}
	}

	/**
	 * @param event the pointer event
	 */
	function onPointerDown(event: PointerEvent): void {
		if (event.pointerType === 'touch') {
			pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
			pinchDistance = currentPinch()
		}
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
		if (event.pointerType === 'touch' && pointers.has(event.pointerId)) {
			pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
			const distance = currentPinch()
			if (distance !== null && pinchDistance !== null && pinchDistance > 0) {
				applyZoom(context.viewZoom.value * (distance / pinchDistance))
				pinchDistance = distance
				return
			}
		}
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
	 * @param event
	 */
	/**
	 * @param event the pointer event, absent when invoked as a reset
	 */
	function onPointerUp(event?: PointerEvent): void {
		if (event !== undefined) {
			pointers.delete(event.pointerId)
			pinchDistance = currentPinch()
		}
		dragFrom = null
	}

	/**
	 * @param event the wheel event
	 */
	function onWheel(event: WheelEvent): void {
		if (event.ctrlKey || event.metaKey) {
			event.preventDefault()
			const previous = context.viewZoom.value
			const next = previous * (event.deltaY < 0 ? 1.1 : 1 / 1.1)
			const zoom = next < 1.05 ? 1 : Math.min(4, next)
			context.viewZoom.value = zoom
			if (zoom === 1) {
				context.viewPan.value = { x: 0, y: 0 }
				return
			}
			// Keep the point under the cursor fixed: pan scales with the
			// zoom and shifts by the cursor's offset from the center
			const rect = element.value?.getBoundingClientRect()
			if (rect !== undefined) {
				const factor = zoom / previous
				const cursor = {
					x: event.clientX - rect.x - rect.width / 2,
					y: event.clientY - rect.y - rect.height / 2,
				}
				const pan = context.viewPan.value
				context.viewPan.value = {
					x: cursor.x - factor * (cursor.x - pan.x),
					y: cursor.y - factor * (cursor.y - pan.y),
				}
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
