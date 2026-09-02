/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Rect } from './state.ts'

import Konva from 'konva'

export type TransitionKind
	= | 'load'
		| 'rotate-cw'
		| 'rotate-ccw'
		| 'flip-h'
		| 'flip-v'
		| 'crop'

export interface TransitionContext {
	/** View scale before the change */
	previousScale: number
	/** Stage offset of the previous view */
	previousOffset: { x: number, y: number }
	/** Scene-space origin of the previous view (crop corner or 0,0) */
	previousOrigin: { x: number, y: number }
}

export interface TransitionDeps {
	/**
	 * The content group inside the view group: it starts at the inverse
	 * of the edit and eases to identity, so the tween never touches the
	 * view transform the reconciler owns
	 */
	group: Konva.Group
	/** Scene-space rect currently visible after the change */
	visible: Rect
	/** View scale after the change */
	scale: number
	/** Stage offset of the view after the change */
	offset: { x: number, y: number }
	/** Scene-space origin of the view after the change */
	origin: { x: number, y: number }
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
 * Re-anchor the group so its transform pivots on the visible center
 * while rendering identically. Enables rotation/scale tweens around the
 * visual center instead of the group origin.
 *
 * @param deps the transition target
 */
function pivotOnCenter(deps: TransitionDeps): void {
	const center = {
		x: deps.visible.x + deps.visible.width / 2,
		y: deps.visible.y + deps.visible.height / 2,
	}
	deps.group.offset(center)
	deps.group.position(center)
}

/**
 * Play a cosmetic transition on the freshly reconciled scene: the
 * content group starts at the inverse transform of the edit and eases
 * to identity. State is already committed and the view transform lives
 * on the parent group, so skipping or interrupting the tween can never
 * corrupt anything; an interrupted tween still ends at identity.
 *
 * @param kind which edit happened
 * @param deps the reconciled scene and view
 * @param context metrics of the view before the edit
 */
export function playTransition(kind: TransitionKind, deps: TransitionDeps, context: TransitionContext): void {
	if (prefersReducedMotion()) {
		return
	}

	const { group, scale } = deps
	const easing = Konva.Easings.EaseInOut
	// Neutral base: a previous transition may have left its pivot behind
	group.setAttrs({ x: 0, y: 0, offsetX: 0, offsetY: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 })

	// How much larger the previous view was, in content units
	const ratio = context.previousScale / scale

	switch (kind) {
		case 'load':
			pivotOnCenter(deps)
			group.opacity(0)
			group.scale({ x: 0.96, y: 0.96 })
			group.to({ opacity: 1, scaleX: 1, scaleY: 1, duration: DURATION, easing })
			return
		case 'rotate-cw':
		case 'rotate-ccw':
			pivotOnCenter(deps)
			group.rotation(kind === 'rotate-cw' ? -90 : 90)
			group.scale({ x: ratio, y: ratio })
			group.to({ rotation: 0, scaleX: 1, scaleY: 1, duration: DURATION, easing })
			return
		case 'flip-h':
			pivotOnCenter(deps)
			group.scaleX(-1)
			group.to({ scaleX: 1, duration: DURATION, easing })
			return
		case 'flip-v':
			pivotOnCenter(deps)
			group.scaleY(-1)
			group.to({ scaleY: 1, duration: DURATION, easing })
			return
		case 'crop': {
			// Start exactly at the previous view, expressed relative to the
			// new one, and ease to identity
			const { previousScale, previousOffset, previousOrigin } = context
			group.scale({ x: ratio, y: ratio })
			group.position({
				x: ((previousOffset.x - previousOrigin.x * previousScale) - (deps.offset.x - deps.origin.x * scale)) / scale,
				y: ((previousOffset.y - previousOrigin.y * previousScale) - (deps.offset.y - deps.origin.y * scale)) / scale,
			})
			group.to({ x: 0, y: 0, scaleX: 1, scaleY: 1, duration: DURATION, easing })
		}
	}
}
