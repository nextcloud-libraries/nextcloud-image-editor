/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { ComputedRef } from 'vue'

import { computed, shallowRef } from 'vue'

export interface HistoryEntry<T> {
	/** The recorded state */
	snapshot: T
	/**
	 * What the user did to get here, already translated. Undefined for
	 * a step whose call site did not name it.
	 */
	label?: string
}

export interface UseHistory<T> {
	/** Whether an older snapshot is available */
	canUndo: ComputedRef<boolean>
	/** Whether a newer snapshot is available */
	canRedo: ComputedRef<boolean>
	/** The active snapshot, undefined while the history is empty */
	current: ComputedRef<T | undefined>
	/** Every recorded step, oldest first */
	entries: ComputedRef<readonly HistoryEntry<T>[]>
	/** Position of the active step in entries, -1 while empty */
	index: ComputedRef<number>
	/**
	 * Append a snapshot after the active one, discarding any redoable
	 * entries.
	 *
	 * @param snapshot the state to record
	 * @param label what the user did, for a history list
	 */
	push(snapshot: T, label?: string): void
	/** Move back one snapshot and return it, or undefined at the oldest entry */
	undo(): T | undefined
	/** Move forward one snapshot and return it, or undefined at the newest entry */
	redo(): T | undefined
	/**
	 * Move to an arbitrary step and return its snapshot, or undefined
	 * where there is no such step or it is the active one already.
	 *
	 * @param target position in entries
	 */
	jumpTo(target: number): T | undefined
	/** Drop all snapshots */
	clear(): void
}

/**
 * Linear undo/redo history of immutable state snapshots.
 *
 * Snapshots are treated as opaque immutable values. Whatever is pushed
 * must not be mutated afterwards, or the history it sits in changes
 * under the caller; pushing a reference to a value the caller keeps
 * building new versions of is fine, and cheaper than copying.
 *
 * @param capacity maximum number of snapshots kept, oldest dropped first
 */
export function useHistory<T>(capacity = 100): UseHistory<T> {
	if (!Number.isInteger(capacity) || capacity < 1) {
		throw new RangeError('History capacity must be a positive integer')
	}

	const entries = shallowRef<HistoryEntry<T>[]>([])
	const index = shallowRef(-1)

	const canUndo = computed(() => index.value > 0)
	const canRedo = computed(() => index.value < entries.value.length - 1)
	const current = computed<T | undefined>(() => entries.value[index.value]?.snapshot)

	/**
	 * Append a snapshot after the active one, discarding any redoable entries.
	 *
	 * @param snapshot the state to record
	 * @param label what the user did, for a history list
	 */
	function push(snapshot: T, label?: string): void {
		const kept = [...entries.value.slice(0, index.value + 1), { snapshot, label }]
		entries.value = kept.slice(Math.max(0, kept.length - capacity))
		index.value = entries.value.length - 1
	}

	/**
	 * Move to an arbitrary step and return its snapshot.
	 *
	 * @param target position in entries
	 */
	function jumpTo(target: number): T | undefined {
		if (target === index.value || target < 0 || target >= entries.value.length) {
			return undefined
		}
		index.value = target
		return current.value
	}

	/**
	 * Move back one snapshot and return it, or undefined at the oldest entry.
	 */
	function undo(): T | undefined {
		return canUndo.value ? jumpTo(index.value - 1) : undefined
	}

	/**
	 * Move forward one snapshot and return it, or undefined at the newest entry.
	 */
	function redo(): T | undefined {
		return canRedo.value ? jumpTo(index.value + 1) : undefined
	}

	/**
	 * Drop all snapshots.
	 */
	function clear(): void {
		entries.value = []
		index.value = -1
	}

	return {
		canUndo,
		canRedo,
		current,
		entries: computed(() => entries.value),
		index: computed(() => index.value),
		push,
		undo,
		redo,
		jumpTo,
		clear,
	}
}
