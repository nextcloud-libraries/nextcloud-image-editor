/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { describe, expect, it } from 'vitest'
import { defaultOrigin, originPosition, snapToOrigin } from '../lib/editor/slider.ts'

describe('defaultOrigin', () => {
	it('is zero for a range crossing it', () => {
		expect(defaultOrigin(-100, 100)).toBe(0)
		expect(defaultOrigin(-45, 45)).toBe(0)
	})

	it('is nothing for a range that never reaches zero', () => {
		expect(defaultOrigin(1, 3)).toBeNull()
		expect(defaultOrigin(8, 128)).toBeNull()
	})

	it('is nothing where zero is an end of the range', () => {
		// The mark would sit under the thumb's resting place
		expect(defaultOrigin(0, 100)).toBeNull()
		expect(defaultOrigin(-100, 0)).toBeNull()
	})
})

describe('originPosition', () => {
	it('is the middle of a symmetric range', () => {
		expect(originPosition(0, -100, 100)).toBe(0.5)
	})

	it('follows an off-centre origin', () => {
		expect(originPosition(1, 1, 3)).toBe(0)
		expect(originPosition(2, 1, 3)).toBe(0.5)
	})
})

describe('snapToOrigin', () => {
	it('pulls a value next to the origin onto it', () => {
		expect(snapToOrigin(3, 0, -100, 100)).toBe(0)
		expect(snapToOrigin(-4, 0, -100, 100)).toBe(0)
	})

	it('leaves a value past the snap zone alone', () => {
		expect(snapToOrigin(5, 0, -100, 100)).toBe(5)
		expect(snapToOrigin(-30, 0, -100, 100)).toBe(-30)
	})

	it('scales the zone with the range', () => {
		// 2% of 90 is 1.8, so one step out is already clear of it
		expect(snapToOrigin(1, 0, -45, 45)).toBe(0)
		expect(snapToOrigin(2, 0, -45, 45)).toBe(2)
	})

	it('snaps to an origin that is not zero', () => {
		expect(snapToOrigin(1.03, 1, 1, 3)).toBe(1)
		expect(snapToOrigin(1.2, 1, 1, 3)).toBe(1.2)
	})

	it('leaves every value alone without an origin', () => {
		expect(snapToOrigin(0.4, null, 1, 3)).toBe(0.4)
	})
})
