/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Ref } from 'vue'
import type { EditorContext } from '../editor/context.ts'

import { onBeforeUnmount, onMounted } from 'vue'

/**
 * Wheel gestures on the canvas: ctrl/cmd + wheel zooms the view,
 * a plain wheel pans it while zoomed.
 *
 * @param element the canvas container
 * @param context the editor context holding the view state
 */
export function useWheelControls(element: Ref<HTMLElement | null>, context: EditorContext): void {
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
		element.value?.addEventListener('wheel', onWheel, { passive: false })
	})
	onBeforeUnmount(() => {
		element.value?.removeEventListener('wheel', onWheel)
	})
}
