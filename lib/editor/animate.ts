/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Point } from './view.ts'

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

/**
 * One node carried by a transition, in its own coordinate space.
 *
 * The content lives in scene space under the view group, while the crop
 * overlay lives in stage space on its own layer. Both have to play the
 * same visual transition, so each target says where its pivot is and
 * how to read a stage-pixel distance in its own units.
 */
export interface TransitionTarget {
	/**
	 * The node to tween: it starts at the inverse of the edit and eases
	 * to identity, so the tween never touches the view transform the
	 * reconciler owns
	 */
	node: Konva.Node
	/** The visible center, in this node's own coordinate space */
	pivot: Point
	/** This node's units per stage pixel: 1 in stage space */
	unit: number
}

export interface TransitionDeps {
	/** Every node playing this transition */
	targets: TransitionTarget[]
	/** View scale after the change */
	scale: number
	/** Stage offset of the view after the change */
	offset: Point
	/** Scene-space origin of the view after the change */
	origin: Point
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
 * Re-anchor a node so its transform pivots on the visible center while
 * rendering identically. Enables rotation and scale tweens around the
 * visual center instead of the node origin.
 *
 * @param target the node to re-anchor
 */
function pivotOnCenter(target: TransitionTarget): void {
	target.node.offset(target.pivot)
	target.node.position(target.pivot)
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

	const { scale } = deps
	const easing = Konva.Easings.EaseInOut
	// How much larger the previous view was, in content units
	const ratio = context.previousScale / scale

	for (const target of deps.targets) {
		const { node } = target
		// Neutral base: a previous transition may have left its pivot behind
		node.setAttrs({ x: 0, y: 0, offsetX: 0, offsetY: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 })

		switch (kind) {
			case 'load':
				pivotOnCenter(target)
				node.opacity(0)
				node.scale({ x: 0.96, y: 0.96 })
				node.to({ opacity: 1, scaleX: 1, scaleY: 1, duration: DURATION, easing })
				break
			case 'rotate-cw':
			case 'rotate-ccw':
				pivotOnCenter(target)
				node.rotation(kind === 'rotate-cw' ? -90 : 90)
				node.scale({ x: ratio, y: ratio })
				node.to({ rotation: 0, scaleX: 1, scaleY: 1, duration: DURATION, easing })
				break
			case 'flip-h':
				pivotOnCenter(target)
				node.scaleX(-1)
				node.to({ scaleX: 1, duration: DURATION, easing })
				break
			case 'flip-v':
				pivotOnCenter(target)
				node.scaleY(-1)
				node.to({ scaleY: 1, duration: DURATION, easing })
				break
			case 'crop': {
				// Start exactly at the previous view, expressed relative to
				// the new one, and ease to identity
				const { previousScale, previousOffset, previousOrigin } = context
				node.scale({ x: ratio, y: ratio })
				node.position({
					x: ((previousOffset.x - previousOrigin.x * previousScale) - (deps.offset.x - deps.origin.x * scale)) * target.unit,
					y: ((previousOffset.y - previousOrigin.y * previousScale) - (deps.offset.y - deps.origin.y * scale)) * target.unit,
				})
				node.to({ x: 0, y: 0, scaleX: 1, scaleY: 1, duration: DURATION, easing })
				break
			}
		}
	}
}
