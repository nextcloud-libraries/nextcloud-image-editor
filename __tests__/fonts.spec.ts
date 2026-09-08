/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { FontId } from '../lib/editor/fonts.ts'

import { describe, expect, it } from 'vitest'
import { DEFAULT_FONT, FONT_STACKS, fontStack } from '../lib/editor/fonts.ts'

describe('fontStack', () => {
	it('gives the default when the annotation names no family', () => {
		expect(fontStack(undefined)).toBe(FONT_STACKS[DEFAULT_FONT])
	})

	it('gives the stack that was asked for', () => {
		expect(fontStack('serif')).toBe(FONT_STACKS.serif)
		expect(fontStack('mono')).toBe(FONT_STACKS.mono)
	})

	it('falls back rather than drawing nothing for a family it does not know', () => {
		// An annotation from a newer version, or a state a host edited by hand
		expect(fontStack('handwriting' as FontId)).toBe(FONT_STACKS[DEFAULT_FONT])
	})

	it('ends every stack in a generic family, so there is always a face', () => {
		for (const stack of Object.values(FONT_STACKS)) {
			expect(stack).toMatch(/(sans-serif|serif|monospace)$/)
		}
	})

	it('names only faces the system already has, so nothing has to load', () => {
		// A downloaded face that has not arrived when the export renders is
		// silently swapped for a fallback, and the save differs from the screen
		for (const stack of Object.values(FONT_STACKS)) {
			expect(stack).not.toMatch(/url\(|http/)
		}
	})
})
