/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Orientation } from '../lib/utils/orientation.ts'

import { describe, expect, it } from 'vitest'
import { isOrientation, rotateOrientation } from '../lib/utils/orientation.ts'

/** The eight values a file may carry */
const ALL: Orientation[] = [1, 2, 3, 4, 5, 6, 7, 8]

/** The four that describe a mirrored picture */
const MIRRORED: Orientation[] = [2, 4, 5, 7]

/**
 * Turn an orientation the same way several times.
 *
 * @param orientation where to start
 * @param turn which way to go
 * @param times how many quarters to turn
 */
function turn(orientation: Orientation, turn: 'left' | 'right', times: number): Orientation {
	let value = orientation
	for (let i = 0; i < times; i++) {
		value = rotateOrientation(value, turn)
	}
	return value
}

describe('isOrientation', () => {
	it('accepts the eight the format defines', () => {
		expect(ALL.every(isOrientation)).toBe(true)
	})

	it('rejects everything else, so a stray value cannot turn a picture', () => {
		for (const value of [0, 9, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 65535]) {
			expect(isOrientation(value)).toBe(false)
		}
	})
})

describe('rotateOrientation', () => {
	it('turns an ordinary picture the way it was asked', () => {
		// 8 is "rotate 270 CW", which is what a left turn asks a reader for
		expect(rotateOrientation(1, 'left')).toBe(8)
		// 6 is "rotate 90 CW"
		expect(rotateOrientation(1, 'right')).toBe(6)
	})

	it('comes back to where it started after four turns', () => {
		for (const orientation of ALL) {
			expect(turn(orientation, 'left', 4)).toBe(orientation)
			expect(turn(orientation, 'right', 4)).toBe(orientation)
		}
	})

	it('undoes a turn with one the other way', () => {
		for (const orientation of ALL) {
			expect(rotateOrientation(rotateOrientation(orientation, 'left'), 'right')).toBe(orientation)
			expect(rotateOrientation(rotateOrientation(orientation, 'right'), 'left')).toBe(orientation)
		}
	})

	it('reaches the same place going three one way or one the other', () => {
		for (const orientation of ALL) {
			expect(turn(orientation, 'left', 3)).toBe(rotateOrientation(orientation, 'right'))
		}
	})

	it('leaves a mirrored picture mirrored', () => {
		// Turning a picture cannot flip it: a mirror that survived a turn
		// would be a mirror nobody asked for
		for (const orientation of ALL) {
			const mirrored = MIRRORED.includes(orientation)
			for (const direction of ['left', 'right'] as const) {
				expect(MIRRORED.includes(rotateOrientation(orientation, direction))).toBe(mirrored)
			}
		}
	})

	it('sends the eight to eight different places', () => {
		// A turn is a relabelling of the eight, so nothing may collapse:
		// two orientations landing on one would lose a distinction
		for (const direction of ['left', 'right'] as const) {
			const landed = new Set(ALL.map((orientation) => rotateOrientation(orientation, direction)))
			expect(landed.size).toBe(ALL.length)
		}
	})
})
