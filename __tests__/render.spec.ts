/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { describe, expect, it } from 'vitest'
import { supportsContextFilter } from '../lib/editor/render.ts'

/** A context that honors the filter property, like Chrome or Firefox */
function honoringContext(): Pick<CanvasRenderingContext2D, 'filter'> {
	return { filter: 'none' }
}

/** A context that ignores writes, like WebKit before Safari 18 */
function ignoringContext(): Pick<CanvasRenderingContext2D, 'filter'> {
	return {
		get filter() {
			return 'none'
		},
		set filter(_value: string) {
			// Dropped on the floor, exactly as the unsupporting engines do
		},
	}
}

describe('supportsContextFilter', () => {
	it('detects support when the assignment sticks', () => {
		expect(supportsContextFilter(honoringContext())).toBe(true)
	})

	it('detects the absence of support when the assignment is ignored', () => {
		expect(supportsContextFilter(ignoringContext())).toBe(false)
	})

	it('reports no support without a context at all', () => {
		expect(supportsContextFilter(null)).toBe(false)
	})
})
