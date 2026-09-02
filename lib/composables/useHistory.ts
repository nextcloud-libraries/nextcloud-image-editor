/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { ComputedRef } from 'vue'

import { computed, shallowRef } from 'vue'

export interface UseHistory<T> {
	/** Whether an older snapshot is available */
	canUndo: ComputedRef<boolean>
	/** Whether a newer snapshot is available */
	canRedo: ComputedRef<boolean>
	/** The active snapshot, undefined while the history is empty */
	current: ComputedRef<T | undefined>
	/** Append a snapshot after the active one, discarding any redoable entries */
	push(snapshot: T): void
	/** Move back one snapshot and return it, or undefined at the oldest entry */
	undo(): T | undefined
	/** Move forward one snapshot and return it, or undefined at the newest entry */
	redo(): T | undefined
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

	const entries = shallowRef<T[]>([])
	const index = shallowRef(-1)

	const canUndo = computed(() => index.value > 0)
	const canRedo = computed(() => index.value < entries.value.length - 1)
	const current = computed<T | undefined>(() => entries.value[index.value])

	/**
	 * Append a snapshot after the active one, discarding any redoable entries.
	 *
	 * @param snapshot the state to record
	 */
	function push(snapshot: T): void {
		const kept = [...entries.value.slice(0, index.value + 1), snapshot]
		entries.value = kept.slice(Math.max(0, kept.length - capacity))
		index.value = entries.value.length - 1
	}

	/**
	 * Move back one snapshot and return it, or undefined at the oldest entry.
	 */
	function undo(): T | undefined {
		if (!canUndo.value) {
			return undefined
		}
		index.value -= 1
		return current.value
	}

	/**
	 * Move forward one snapshot and return it, or undefined at the newest entry.
	 */
	function redo(): T | undefined {
		if (!canRedo.value) {
			return undefined
		}
		index.value += 1
		return current.value
	}

	/**
	 * Drop all snapshots.
	 */
	function clear(): void {
		entries.value = []
		index.value = -1
	}

	return { canUndo, canRedo, current, push, undo, redo, clear }
}
