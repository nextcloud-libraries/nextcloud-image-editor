/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/** How much of the travel around the origin snaps to it */
const SNAP_RATIO = 0.02

/**
 * The value a range returns to, or null where it has none: a range
 * crossing zero is neutral there, one that does not is only neutral
 * where its owner says so.
 *
 * @param min lower bound
 * @param max upper bound
 */
export function defaultOrigin(min: number, max: number): number | null {
	return min < 0 && max > 0 ? 0 : null
}

/**
 * Where the origin sits along the track, as a fraction of the travel.
 *
 * @param origin the neutral value
 * @param min lower bound
 * @param max upper bound
 */
export function originPosition(origin: number, min: number, max: number): number {
	return (origin - min) / (max - min)
}

/**
 * Pull a value onto the origin when it lands next to it. Returning to
 * neutral is the one value a drag has to be able to hit exactly, and a
 * fine range makes it a pixel wide without this.
 *
 * @param value the dragged value
 * @param origin the neutral value, or null where the range has none
 * @param min lower bound
 * @param max upper bound
 */
export function snapToOrigin(value: number, origin: number | null, min: number, max: number): number {
	if (origin === null) {
		return value
	}
	return Math.abs(value - origin) <= (max - min) * SNAP_RATIO ? origin : value
}
