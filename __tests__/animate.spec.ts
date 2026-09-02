/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { playTransition, prefersReducedMotion } from '../lib/editor/animate.ts'

interface Call { [key: string]: unknown }

/**
 * A fake Konva group recording every mutation and tween request.
 */
function fakeGroup() {
	const calls: { tweens: Call[], sets: Call[] } = { tweens: [], sets: [] }
	const group = {
		setAttrs: (value: Call) => calls.sets.push({ setAttrs: value }),
		offset: (value?: Call) => value && calls.sets.push({ offset: value }),
		position: (value?: Call) => value && calls.sets.push({ position: value }),
		scale: (value?: Call) => value && calls.sets.push({ scale: value }),
		scaleX: (value?: number) => value !== undefined && calls.sets.push({ scaleX: value }),
		scaleY: (value?: number) => value !== undefined && calls.sets.push({ scaleY: value }),
		rotation: (value?: number) => value !== undefined && calls.sets.push({ rotation: value }),
		opacity: (value?: number) => value !== undefined && calls.sets.push({ opacity: value }),
		to: (tween: Call) => calls.tweens.push(tween),
	}
	return { group, calls }
}

function DEPS(group: unknown) {
	return {
		group: group as never,
		visible: { x: 0, y: 0, width: 400, height: 300 },
		scale: 1.5,
		offset: { x: 40, y: 30 },
		origin: { x: 0, y: 0 },
	}
}

const CONTEXT = {
	previousScale: 1,
	previousOffset: { x: 10, y: 20 },
	previousOrigin: { x: 0, y: 0 },
}

describe('playTransition', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('does nothing under prefers-reduced-motion', () => {
		vi.stubGlobal('matchMedia', () => ({ matches: true }))
		expect(prefersReducedMotion()).toBe(true)

		const { group, calls } = fakeGroup()
		playTransition('rotate-cw', DEPS(group), CONTEXT)
		expect(calls.tweens).toHaveLength(0)
		expect(calls.sets).toHaveLength(0)
	})

	it('resets the group before arranging any transition', () => {
		vi.stubGlobal('matchMedia', () => ({ matches: false }))
		const { group, calls } = fakeGroup()
		playTransition('flip-v', DEPS(group), CONTEXT)

		expect(calls.sets[0]).toEqual({
			setAttrs: { x: 0, y: 0, offsetX: 0, offsetY: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
		})
	})

	it('starts a clockwise turn at minus ninety degrees and eases to identity', () => {
		vi.stubGlobal('matchMedia', () => ({ matches: false }))
		const { group, calls } = fakeGroup()
		playTransition('rotate-cw', DEPS(group), CONTEXT)

		expect(calls.sets).toContainEqual({ rotation: -90 })
		// The previous view was smaller: 1 / 1.5 in content units
		expect(calls.sets).toContainEqual({ scale: { x: 1 / 1.5, y: 1 / 1.5 } })
		expect(calls.tweens[0]).toMatchObject({ rotation: 0, scaleX: 1, scaleY: 1 })
	})

	it('pivots rotations on the visible center', () => {
		vi.stubGlobal('matchMedia', () => ({ matches: false }))
		const { group, calls } = fakeGroup()
		playTransition('rotate-ccw', DEPS(group), CONTEXT)

		expect(calls.sets).toContainEqual({ offset: { x: 200, y: 150 } })
		expect(calls.sets).toContainEqual({ position: { x: 200, y: 150 } })
	})

	it('mirrors a horizontal flip through negative unit scale', () => {
		vi.stubGlobal('matchMedia', () => ({ matches: false }))
		const { group, calls } = fakeGroup()
		playTransition('flip-h', DEPS(group), CONTEXT)

		expect(calls.sets).toContainEqual({ scaleX: -1 })
		expect(calls.tweens[0]).toMatchObject({ scaleX: 1 })
	})

	it('fades and settles the freshly loaded image', () => {
		vi.stubGlobal('matchMedia', () => ({ matches: false }))
		const { group, calls } = fakeGroup()
		playTransition('load', DEPS(group), CONTEXT)

		expect(calls.sets).toContainEqual({ opacity: 0 })
		expect(calls.tweens[0]).toMatchObject({ opacity: 1, scaleX: 1, scaleY: 1 })
	})

	it('starts a crop exactly at the previous view relative to the new one', () => {
		vi.stubGlobal('matchMedia', () => ({ matches: false }))
		const { group, calls } = fakeGroup()
		const deps = DEPS(group)
		playTransition('crop', deps, CONTEXT)

		// (previous view translation - new view translation) / new scale
		const expected = {
			x: ((10 - 0 * 1) - (40 - 0 * 1.5)) / 1.5,
			y: ((20 - 0 * 1) - (30 - 0 * 1.5)) / 1.5,
		}
		expect(calls.sets).toContainEqual({ position: expected })
		expect(calls.sets).toContainEqual({ scale: { x: 1 / 1.5, y: 1 / 1.5 } })
		expect(calls.tweens[0]).toMatchObject({ x: 0, y: 0, scaleX: 1, scaleY: 1 })
	})
})
