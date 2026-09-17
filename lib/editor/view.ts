/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Rect, Size } from './state.ts'

/** Stage margin kept free so handles at the image edge stay grabbable */
export const VIEW_MARGIN = 16

/**
 * How far past its own edges the picture may be pushed, as a share of
 * the container. The chrome floats over the stage and covers about a
 * quarter of it at the bottom, so a third leaves every part of a fitted
 * picture reachable.
 */
export const PAN_SLACK = 1 / 3

/** The whole visible area at the size the container allows */
export const FIT_ZOOM = 1

/**
 * How far the view may be zoomed out past the fitted one. The chrome
 * floats over the picture, so the fitted view hides a band of it behind
 * the control card: zooming out is how the user looks under it.
 */
export const MIN_ZOOM = 0.5

/** Past this the view shows mostly interpolation */
export const MAX_ZOOM = 4

/** Requested zooms this close to the fitted one snap onto it */
export const ZOOM_SNAP = 1.05

/** Relative pinch change treated as a zoom rather than a two-finger pan */
export const PINCH_TOLERANCE = 0.01

/** Pixels one wheel line stands for, for the engines reporting lines */
const WHEEL_LINE = 16

/** Largest single-event travel honored, so one flick cannot jump the range */
const WHEEL_CLAMP = 300

/** Zoom change per pixel of wheel travel */
const WHEEL_SENSITIVITY = 0.0015

export interface Point {
	x: number
	y: number
}

/**
 * The fitted view of the visible image area, published by the editor
 * component so the view setters can clamp against the same metrics the
 * renderer uses.
 */
export interface ViewFit {
	/** Scale fitting the visible area into the container, at zoom 1 */
	scale: number
	/** Scene-space area on display: the crop, or the whole image */
	visible: Rect
	/** Container size in stage pixels */
	container: Size
	/** Whether the view is clipped to the crop */
	showCropped: boolean
}

/**
 * How far the view may be panned away from center, per axis: half of
 * whatever does not fit, or the slack, whichever is the larger, plus
 * the stage margin.
 *
 * The overflow half is what it takes to reach the far side of a picture
 * larger than the container. The slack is for the fitted view, which
 * has next to no overflow and still hides a band of the picture behind
 * the chrome floating over the stage: it is what makes that band
 * reachable by sliding the picture rather than only by zooming into it.
 *
 * @param visible the scene-space area on display
 * @param scale the applied view scale, zoom included
 * @param container the container size in stage pixels
 */
export function panBounds(visible: Size, scale: number, container: Size): Point {
	return {
		x: Math.max(Math.abs(visible.width * scale - container.width) / 2, container.width * PAN_SLACK) + VIEW_MARGIN,
		y: Math.max(Math.abs(visible.height * scale - container.height) / 2, container.height * PAN_SLACK) + VIEW_MARGIN,
	}
}

/**
 * Hold a pan offset inside the given bounds.
 *
 * @param pan the requested offset
 * @param bounds the maximum offset per axis
 */
export function clampPan(pan: Point, bounds: Point): Point {
	return {
		x: Math.min(bounds.x, Math.max(-bounds.x, pan.x)),
		y: Math.min(bounds.y, Math.max(-bounds.y, pan.y)),
	}
}

/**
 * Hold a zoom factor inside the range, landing exactly on the fitted
 * view when a gesture crosses it.
 *
 * The snap is deliberately only applied on the way through: a pinch
 * that starts at the fitted view has to be able to leave it, and a
 * band that also caught the view it is already on would swallow every
 * small step until the gesture is released and started again.
 *
 * @param zoom the requested factor
 * @param previous the factor the view is on, unset where there is none
 */
export function clampZoom(zoom: number, previous = FIT_ZOOM): number {
	const bounded = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
	const crossed = (previous - FIT_ZOOM) * (bounded - FIT_ZOOM) < 0
	const near = bounded > FIT_ZOOM / ZOOM_SNAP && bounded < FIT_ZOOM * ZOOM_SNAP
	return crossed && near ? FIT_ZOOM : bounded
}

/**
 * The pan offset that keeps the point under the cursor fixed while the
 * zoom changes by the given factor.
 *
 * @param pan the current offset
 * @param cursor the cursor position relative to the container center
 * @param factor the new zoom divided by the previous one
 */
export function anchoredPan(pan: Point, cursor: Point, factor: number): Point {
	return {
		x: cursor.x - factor * (cursor.x - pan.x),
		y: cursor.y - factor * (cursor.y - pan.y),
	}
}

/**
 * Zoom factor for one wheel event.
 *
 * The delta is normalized first: engines report pixels, lines or pages,
 * and a mouse notch carries a far larger delta than a trackpad step. A
 * fixed factor per event would make a mouse wheel crawl, so the travel
 * drives the factor, bounded so a single flick cannot cross the whole
 * zoom range.
 *
 * @param deltaY the event's vertical delta
 * @param deltaMode the event's delta unit: 0 pixels, 1 lines, 2 pages
 * @param pageHeight viewport height, only used for page deltas
 */
export function wheelZoomFactor(deltaY: number, deltaMode: number, pageHeight: number): number {
	const scaled = deltaMode === 1
		? deltaY * WHEEL_LINE
		: deltaMode === 2
			? deltaY * pageHeight
			: deltaY
	const bounded = Math.min(WHEEL_CLAMP, Math.max(-WHEEL_CLAMP, scaled))
	// Exponential so zooming in and out by the same travel cancels out
	return Math.exp(-bounded * WHEEL_SENSITIVITY)
}
