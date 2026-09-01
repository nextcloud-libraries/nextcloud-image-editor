/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Rect, Size } from './state.ts'

import Konva from 'konva'

export type TransitionKind
	= | 'load'
		| 'rotate-cw'
		| 'rotate-ccw'
		| 'flip-h'
		| 'flip-v'
		| 'crop'
		| 'mode-in'
		| 'mode-out'

export interface TransitionContext {
	/** View scale before the change */
	previousScale: number
	/** Stage offset of the previous view */
	previousOffset: { x: number, y: number }
	/** Scene-space origin of the previous view (crop corner or 0,0) */
	previousOrigin: { x: number, y: number }
}

export interface TransitionDeps {
	group: Konva.Group
	/** Stage size, the animation pivots on its center */
	container: Size
	/** Scene-space rect currently visible after the change */
	visible: Rect
	/** View scale after the change */
	scale: number
}

const DURATION = 0.3

/**
 * Whether animations should be skipped for this user.
 */
export function prefersReducedMotion(): boolean {
	return typeof window.matchMedia === 'function'
		&& window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Re-anchor the group so its transform pivots on the container center
 * while rendering identically. Enables rotation/scale tweens around the
 * visual center instead of the group origin.
 *
 * @param deps the transition target
 */
function pivotOnCenter(deps: TransitionDeps): void {
	const { group, container, visible } = deps
	group.offset({
		x: visible.x + visible.width / 2,
		y: visible.y + visible.height / 2,
	})
	group.position({
		x: container.width / 2,
		y: container.height / 2,
	})
}

/**
 * Play a cosmetic transition on the freshly rebuilt scene: the group
 * starts at the inverse transform of the edit and eases to identity.
 * State is already committed, so skipping or interrupting the tween can
 * never corrupt anything.
 *
 * @param kind which edit happened
 * @param deps the rebuilt scene and view
 * @param context metrics of the view before the edit
 */
export function playTransition(kind: TransitionKind, deps: TransitionDeps, context: TransitionContext): void {
	if (prefersReducedMotion()) {
		return
	}

	const { group, container, scale } = deps
	const easing = Konva.Easings.EaseInOut
	pivotOnCenter(deps)

	switch (kind) {
		case 'mode-in':
		case 'mode-out': {
			// Modes rest at different fits (crop keeps more air), so the
			// zoom really travels between them; equal fits get a pulse
			const scales = Math.abs(context.previousScale - scale) > 0.001
				? context.previousScale
				: scale * (kind === 'mode-out' ? 1.04 : 0.96)
			group.opacity(0.9)
			group.scale({ x: scales, y: scales })
			group.to({ opacity: 1, scaleX: scale, scaleY: scale, duration: 0.28, easing })
			return
		}
		case 'load':
			group.opacity(0)
			group.scale({ x: scale * 0.96, y: scale * 0.96 })
			group.to({ opacity: 1, scaleX: scale, scaleY: scale, duration: DURATION, easing })
			return
		case 'rotate-cw':
		case 'rotate-ccw':
			group.rotation(kind === 'rotate-cw' ? -90 : 90)
			group.scale({ x: context.previousScale, y: context.previousScale })
			group.to({ rotation: 0, scaleX: scale, scaleY: scale, duration: DURATION, easing })
			return
		case 'flip-h':
			group.scaleX(-scale)
			group.to({ scaleX: scale, duration: DURATION, easing })
			return
		case 'flip-v':
			group.scaleY(-scale)
			group.to({ scaleY: scale, duration: DURATION, easing })
			return
		case 'crop': {
			// Start where the (now cropped) region sat in the previous view
			// and zoom to its new fitted position
			const { previousScale, previousOffset, previousOrigin } = context
			const center = {
				x: deps.visible.x + deps.visible.width / 2,
				y: deps.visible.y + deps.visible.height / 2,
			}
			group.scale({ x: previousScale, y: previousScale })
			group.position({
				x: previousOffset.x + (center.x - previousOrigin.x) * previousScale,
				y: previousOffset.y + (center.y - previousOrigin.y) * previousScale,
			})
			group.to({
				x: container.width / 2,
				y: container.height / 2,
				scaleX: scale,
				scaleY: scale,
				duration: DURATION,
				easing,
			})
		}
	}
}
