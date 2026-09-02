/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { ComputedRef, Ref } from 'vue'
import type { EditorContext } from '../editor/context.ts'
import type { Point } from '../editor/view.ts'

import { computed, onBeforeUnmount, onMounted, shallowRef } from 'vue'
import { MIN_ZOOM, PINCH_TOLERANCE, wheelZoomFactor } from '../editor/view.ts'
import { ownsSpaceKey } from '../utils/dom.ts'

export interface WheelControls {
	/** Whether a pan gesture would be taken right now, for the cursor */
	panArmed: ComputedRef<boolean>
}

/** Both active touch points of a pinch, in client coordinates */
interface Pinch {
	distance: number
	centroid: Point
}

/**
 * View gestures on the canvas.
 *
 * The wheel always zooms at the cursor, which is what a canvas editor
 * is expected to do and what a trackpad pinch already sent as
 * ctrl+wheel. Panning is therefore on the drag gestures: the middle
 * button or a held space bar in every mode, plus a plain drag in the
 * modes where no canvas tool owns one. Two fingers zoom or pan
 * depending on whether they change distance.
 *
 * A claimed gesture stops the event from reaching the Konva stage, so
 * panning can never draw, move an annotation or resize the crop.
 *
 * @param element the canvas container
 * @param context the editor context holding the view state
 */
export function useWheelControls(element: Ref<HTMLElement | null>, context: EditorContext): WheelControls {
	let dragFrom: { pointer: Point, pan: Point } | null = null
	let pinch: Pinch | null = null
	const pointers = new Map<number, Point>()
	const spaceHeld = shallowRef(false)

	/** Modes without a canvas tool: a plain drag is free to pan */
	const toolFreeDrag = () => context.activeTool.value === 'adjust'
	const zoomed = () => context.viewZoom.value > MIN_ZOOM

	const panArmed = computed(() => context.viewZoom.value > MIN_ZOOM
		&& (spaceHeld.value || context.activeTool.value === 'adjust'))

	/**
	 * Turn a client position into an offset from the container center,
	 * which is the anchor the zoom math works in.
	 *
	 * @param position the client position
	 */
	function anchorAt(position: Point): Point | undefined {
		const rect = element.value?.getBoundingClientRect()
		if (rect === undefined) {
			return undefined
		}
		return {
			x: position.x - rect.x - rect.width / 2,
			y: position.y - rect.y - rect.height / 2,
		}
	}

	/**
	 * Distance and midpoint of the two active touch points.
	 */
	function currentPinch(): Pinch | null {
		if (pointers.size !== 2) {
			return null
		}
		const [a, b] = [...pointers.values()] as [Point, Point]
		return {
			distance: Math.hypot(a.x - b.x, a.y - b.y),
			centroid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
		}
	}

	/**
	 * The wheel zooms at the cursor. The canvas owns the gesture, so the
	 * page behind the editor never scrolls and the browser never zooms.
	 *
	 * @param event the wheel event
	 */
	function onWheel(event: WheelEvent): void {
		event.preventDefault()
		if (event.deltaY === 0) {
			return
		}
		const height = element.value?.clientHeight ?? window.innerHeight
		const factor = wheelZoomFactor(event.deltaY, event.deltaMode, height)
		context.setViewZoom(context.viewZoom.value * factor, anchorAt({ x: event.clientX, y: event.clientY }))
	}

	/**
	 * @param event the pointer event
	 */
	function onPointerDown(event: PointerEvent): void {
		if (event.pointerType === 'touch') {
			pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
			if (pointers.size === 2) {
				pinch = currentPinch()
				// Two fingers drive the view: whatever the tool started on
				// the first finger is abandoned rather than committed
				context.panning.value = true
				event.stopPropagation()
			}
			return
		}
		// The middle button pans anywhere; the left button only where no
		// tool owns the drag, or while the space bar is held
		const wantsPan = event.button === 1 || (event.button === 0 && (spaceHeld.value || toolFreeDrag()))
		if (!wantsPan || !zoomed()) {
			return
		}
		// Claim the gesture before the stage sees it
		event.preventDefault()
		event.stopPropagation()
		dragFrom = {
			pointer: { x: event.clientX, y: event.clientY },
			pan: context.viewPan.value,
		}
		context.panning.value = true
		element.value?.setPointerCapture(event.pointerId)
	}

	/**
	 * @param event the pointer event
	 */
	function onPointerMove(event: PointerEvent): void {
		if (event.pointerType === 'touch' && pointers.has(event.pointerId)) {
			pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
			const next = currentPinch()
			if (next === null || pinch === null) {
				return
			}
			event.stopPropagation()
			const ratio = next.distance / pinch.distance
			if (Math.abs(ratio - 1) > PINCH_TOLERANCE) {
				context.setViewZoom(context.viewZoom.value * ratio, anchorAt(next.centroid))
			} else {
				context.setViewPan({
					x: context.viewPan.value.x + next.centroid.x - pinch.centroid.x,
					y: context.viewPan.value.y + next.centroid.y - pinch.centroid.y,
				})
			}
			pinch = next
			return
		}
		if (dragFrom === null) {
			return
		}
		event.stopPropagation()
		context.setViewPan({
			x: dragFrom.pan.x + (event.clientX - dragFrom.pointer.x),
			y: dragFrom.pan.y + (event.clientY - dragFrom.pointer.y),
		})
	}

	/**
	 * @param event the pointer event, absent when invoked as a reset
	 */
	function onPointerUp(event?: PointerEvent): void {
		if (event !== undefined) {
			pointers.delete(event.pointerId)
		}
		pinch = currentPinch()
		dragFrom = null
		if (pointers.size < 2) {
			context.panning.value = false
		}
	}

	/**
	 * @param event the keyboard event
	 */
	function onKeydown(event: KeyboardEvent): void {
		if (event.code !== 'Space' || ownsSpaceKey(event.target)) {
			return
		}
		// Space is the pan modifier here, not a page scroll
		event.preventDefault()
		spaceHeld.value = true
	}

	/**
	 * @param event the keyboard event
	 */
	function onKeyup(event: KeyboardEvent): void {
		if (event.code === 'Space') {
			spaceHeld.value = false
		}
	}

	onMounted(() => {
		const target = element.value
		target?.addEventListener('wheel', onWheel, { passive: false })
		// Capture phase: the stage listens on a descendant, so a claimed
		// gesture has to be intercepted on the way down
		target?.addEventListener('pointerdown', onPointerDown, { capture: true })
		target?.addEventListener('pointermove', onPointerMove, { capture: true })
		target?.addEventListener('pointerup', onPointerUp)
		target?.addEventListener('pointercancel', onPointerUp)
		window.addEventListener('keydown', onKeydown)
		window.addEventListener('keyup', onKeyup)
	})
	onBeforeUnmount(() => {
		const target = element.value
		target?.removeEventListener('wheel', onWheel)
		target?.removeEventListener('pointerdown', onPointerDown, { capture: true })
		target?.removeEventListener('pointermove', onPointerMove, { capture: true })
		target?.removeEventListener('pointerup', onPointerUp)
		target?.removeEventListener('pointercancel', onPointerUp)
		window.removeEventListener('keydown', onKeydown)
		window.removeEventListener('keyup', onKeyup)
	})

	return { panArmed }
}
