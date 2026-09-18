/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * An Exif orientation: the transform a reader applies to the stored pixels
 * to show the picture the right way up.
 *
 * The eight values are the four quarter turns, each of them also available
 * mirrored, so they form the symmetry group of the square rather than a
 * plain 0/90/180/270 counter. That is why turning a picture is a lookup
 * and not an addition (see {@link rotateOrientation}).
 */
export type Orientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

/** What a file means when it carries no orientation at all */
export const DEFAULT_ORIENTATION: Orientation = 1

/** A transform as its two independent parts */
interface Transform {
	/** Clockwise quarter turns, applied after the mirror */
	turns: 0 | 1 | 2 | 3
	/** Whether the stored pixels are mirrored left to right */
	mirrored: boolean
}

/**
 * Each orientation as the transform it stands for: a mirror, applied first
 * and only for the mirrored four, then that many clockwise quarter turns.
 *
 * Read against the Exif names: 6 is "rotate 90 CW", 8 is "rotate 270 CW",
 * 7 is "mirror horizontal and rotate 90 CW", and 5 is "mirror horizontal
 * and rotate 270 CW".
 */
const TRANSFORMS: Record<Orientation, Transform> = {
	1: { turns: 0, mirrored: false },
	2: { turns: 0, mirrored: true },
	3: { turns: 2, mirrored: false },
	4: { turns: 2, mirrored: true },
	5: { turns: 3, mirrored: true },
	6: { turns: 1, mirrored: false },
	7: { turns: 1, mirrored: true },
	8: { turns: 3, mirrored: false },
}

/** Every orientation, so a transform can be named again */
const ALL = Object.keys(TRANSFORMS).map(Number) as Orientation[]

/**
 * Whether a number is one of the eight orientations.
 *
 * Files do carry values outside the range, and a reader that trusts one
 * shows the picture turned some way nobody chose, so anything unknown is
 * better treated as the default.
 *
 * @param value the number read from a file
 */
export function isOrientation(value: number): value is Orientation {
	return Number.isInteger(value) && value >= 1 && value <= 8
}

/**
 * The orientation a picture has after the viewer turns it a quarter.
 *
 * A turn composes with what the file already says rather than replacing
 * it, so a mirrored picture stays mirrored and four turns the same way
 * come back to the start. Quarter turns commute with each other but not
 * with the mirror, which is why only the turn count moves here.
 *
 * @param orientation what the file says now
 * @param turn which way the picture is being turned on screen
 */
export function rotateOrientation(orientation: Orientation, turn: 'left' | 'right'): Orientation {
	const { turns, mirrored } = TRANSFORMS[orientation]
	const turned = (turns + (turn === 'left' ? 3 : 1)) % 4
	// The table pairs every turn count with both mirror states, so the
	// search always lands on one of the eight
	return ALL.find((value) => (
		TRANSFORMS[value].turns === turned && TRANSFORMS[value].mirrored === mirrored
	)) ?? orientation
}
