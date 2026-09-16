/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { describe, expect, it } from 'vitest'
import { HISTORY_ICON_LABELS, historyIcon } from '../lib/editor/history-icons.ts'

describe('historyIcon', () => {
	it('gives every label it knows an icon of its own', () => {
		for (const label of HISTORY_ICON_LABELS) {
			expect(historyIcon(label), label).toBeDefined()
		}
	})

	it('tells the transforms apart', () => {
		expect(historyIcon('Rotate left')).not.toBe(historyIcon('Rotate right'))
		expect(historyIcon('Flip horizontal')).not.toBe(historyIcon('Flip vertical'))
	})

	it('falls back rather than leaving a step without one', () => {
		// A step recorded under a name this list does not know still gets
		// a row in the menu, so it still needs an icon
		expect(historyIcon('Something the map never heard of')).toBe(historyIcon('Edit'))
	})
})
