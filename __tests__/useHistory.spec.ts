/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { describe, expect, it } from 'vitest'
import { useHistory } from '../lib/composables/useHistory.ts'

describe('useHistory', () => {
	it('starts empty', () => {
		const history = useHistory<string>()
		expect(history.current.value).toBeUndefined()
		expect(history.canUndo.value).toBe(false)
		expect(history.canRedo.value).toBe(false)
	})

	it('tracks the pushed snapshot as current', () => {
		const history = useHistory<string>()
		history.push('a')
		expect(history.current.value).toBe('a')
		expect(history.canUndo.value).toBe(false)
		history.push('b')
		expect(history.current.value).toBe('b')
		expect(history.canUndo.value).toBe(true)
	})

	it('undoes and redoes linearly', () => {
		const history = useHistory<string>()
		history.push('a')
		history.push('b')
		history.push('c')

		expect(history.undo()).toBe('b')
		expect(history.undo()).toBe('a')
		expect(history.canUndo.value).toBe(false)
		expect(history.redo()).toBe('b')
		expect(history.redo()).toBe('c')
		expect(history.canRedo.value).toBe(false)
	})

	it('returns undefined instead of moving past the ends', () => {
		const history = useHistory<string>()
		history.push('a')
		expect(history.undo()).toBeUndefined()
		expect(history.redo()).toBeUndefined()
		expect(history.current.value).toBe('a')
	})

	it('discards redoable entries on push', () => {
		const history = useHistory<string>()
		history.push('a')
		history.push('b')
		history.undo()
		history.push('c')

		expect(history.canRedo.value).toBe(false)
		expect(history.current.value).toBe('c')
		expect(history.undo()).toBe('a')
	})

	it('drops the oldest entries beyond capacity', () => {
		const history = useHistory<number>(3)
		history.push(1)
		history.push(2)
		history.push(3)
		history.push(4)

		expect(history.undo()).toBe(3)
		expect(history.undo()).toBe(2)
		expect(history.canUndo.value).toBe(false)
	})

	it('clears all entries', () => {
		const history = useHistory<string>()
		history.push('a')
		history.push('b')
		history.clear()

		expect(history.current.value).toBeUndefined()
		expect(history.canUndo.value).toBe(false)
		expect(history.canRedo.value).toBe(false)
	})

	it('rejects a non-positive or fractional capacity', () => {
		expect(() => useHistory(0)).toThrow(RangeError)
		expect(() => useHistory(-1)).toThrow(RangeError)
		expect(() => useHistory(1.5)).toThrow(RangeError)
	})

	it('records the label its call site gave', () => {
		const history = useHistory<string>()
		history.push('a', 'Rotate right')
		history.push('b')

		expect(history.entries.value.map((entry) => entry.label)).toEqual(['Rotate right', undefined])
		expect(history.entries.value.map((entry) => entry.snapshot)).toEqual(['a', 'b'])
	})

	it('reports where in the list the active step is', () => {
		const history = useHistory<string>()
		expect(history.index.value).toBe(-1)

		history.push('a')
		history.push('b')
		expect(history.index.value).toBe(1)

		history.undo()
		expect(history.index.value).toBe(0)
	})

	it('jumps to an arbitrary step', () => {
		const history = useHistory<string>()
		for (const value of ['a', 'b', 'c', 'd']) {
			history.push(value)
		}

		expect(history.jumpTo(1)).toBe('b')
		expect(history.current.value).toBe('b')
		expect(history.canUndo.value).toBe(true)
		expect(history.canRedo.value).toBe(true)

		expect(history.jumpTo(3)).toBe('d')
		expect(history.canRedo.value).toBe(false)
	})

	it('refuses a jump that goes nowhere', () => {
		const history = useHistory<string>()
		history.push('a')
		history.push('b')

		expect(history.jumpTo(1)).toBeUndefined()
		expect(history.jumpTo(-1)).toBeUndefined()
		expect(history.jumpTo(2)).toBeUndefined()
		expect(history.index.value).toBe(1)
	})

	it('drops the steps after the one jumped to when a new one arrives', () => {
		const history = useHistory<string>()
		for (const value of ['a', 'b', 'c']) {
			history.push(value)
		}
		history.jumpTo(0)
		history.push('d')

		expect(history.entries.value.map((entry) => entry.snapshot)).toEqual(['a', 'd'])
		expect(history.canRedo.value).toBe(false)
	})

	it('keeps the list within its capacity', () => {
		const history = useHistory<number>(3)
		for (const value of [1, 2, 3, 4, 5]) {
			history.push(value)
		}
		expect(history.entries.value.map((entry) => entry.snapshot)).toEqual([3, 4, 5])
		expect(history.index.value).toBe(2)
	})
})
