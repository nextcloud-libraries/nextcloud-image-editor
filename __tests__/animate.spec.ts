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
		container: { width: 800, height: 600 },
		visible: { x: 0, y: 0, width: 400, height: 300 },
		scale: 1.5,
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

	it('starts a clockwise turn at minus ninety degrees', () => {
		vi.stubGlobal('matchMedia', () => ({ matches: false }))
		const { group, calls } = fakeGroup()
		playTransition('rotate-cw', DEPS(group), CONTEXT)

		expect(calls.sets).toContainEqual({ rotation: -90 })
		expect(calls.tweens[0]).toMatchObject({ rotation: 0, scaleX: 1.5, scaleY: 1.5 })
	})

	it('mirrors a horizontal flip through negative scale', () => {
		vi.stubGlobal('matchMedia', () => ({ matches: false }))
		const { group, calls } = fakeGroup()
		playTransition('flip-h', DEPS(group), CONTEXT)

		expect(calls.sets).toContainEqual({ scaleX: -1.5 })
		expect(calls.tweens[0]).toMatchObject({ scaleX: 1.5 })
	})

	it('fades and settles the freshly loaded image', () => {
		vi.stubGlobal('matchMedia', () => ({ matches: false }))
		const { group, calls } = fakeGroup()
		playTransition('load', DEPS(group), CONTEXT)

		expect(calls.sets).toContainEqual({ opacity: 0 })
		expect(calls.tweens[0]).toMatchObject({ opacity: 1 })
	})
})
