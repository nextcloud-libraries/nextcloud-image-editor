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

/** The visible center of a 400x300 area at the origin */
const CENTER = { x: 200, y: 150 }

/**
 * Transition deps for one scene-space node, the content group's case.
 *
 * @param group the fake node
 */
function DEPS(group: unknown) {
	return {
		targets: [{ node: group as never, pivot: CENTER, unit: 1 / 1.5 }],
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

		expect(calls.sets).toContainEqual({ offset: CENTER })
		expect(calls.sets).toContainEqual({ position: CENTER })
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

		// (previous view translation - new view translation) in the
		// target's own units, here scene units at 1 / 1.5
		const sceneUnit = 1 / 1.5
		const expected = {
			x: ((10 - 0 * 1) - (40 - 0 * 1.5)) * sceneUnit,
			y: ((20 - 0 * 1) - (30 - 0 * 1.5)) * sceneUnit,
		}
		expect(calls.sets).toContainEqual({ position: expected })
		expect(calls.sets).toContainEqual({ scale: { x: 1 / 1.5, y: 1 / 1.5 } })
		expect(calls.tweens[0]).toMatchObject({ x: 0, y: 0, scaleX: 1, scaleY: 1 })
	})

	it('carries every target through the same transition', () => {
		vi.stubGlobal('matchMedia', () => ({ matches: false }))
		const content = fakeGroup()
		const overlay = fakeGroup()
		playTransition('rotate-cw', {
			targets: [
				{ node: content.group as never, pivot: CENTER, unit: 1 / 1.5 },
				// The crop overlay: stage space, so its own pivot and unit
				{ node: overlay.group as never, pivot: { x: 340, y: 255 }, unit: 1 },
			],
			scale: 1.5,
			offset: { x: 40, y: 30 },
			origin: { x: 0, y: 0 },
		}, CONTEXT)

		expect(content.calls.sets).toContainEqual({ offset: CENTER })
		expect(overlay.calls.sets).toContainEqual({ offset: { x: 340, y: 255 } })
		// Both turn, so the handles cannot snap while the image eases
		expect(content.calls.sets).toContainEqual({ rotation: -90 })
		expect(overlay.calls.sets).toContainEqual({ rotation: -90 })
		expect(overlay.calls.tweens[0]).toMatchObject({ rotation: 0, scaleX: 1, scaleY: 1 })
	})

	it('reads the crop offset in each target own units', () => {
		vi.stubGlobal('matchMedia', () => ({ matches: false }))
		const content = fakeGroup()
		const overlay = fakeGroup()
		playTransition('crop', {
			targets: [
				{ node: content.group as never, pivot: CENTER, unit: 1 / 1.5 },
				{ node: overlay.group as never, pivot: CENTER, unit: 1 },
			],
			scale: 1.5,
			offset: { x: 40, y: 30 },
			origin: { x: 0, y: 0 },
		}, CONTEXT)

		const stageDelta = { x: 10 - 40, y: 20 - 30 }
		const sceneUnit = 1 / 1.5
		expect(content.calls.sets).toContainEqual({ position: { x: stageDelta.x * sceneUnit, y: stageDelta.y * sceneUnit } })
		expect(overlay.calls.sets).toContainEqual({ position: stageDelta })
	})
})
