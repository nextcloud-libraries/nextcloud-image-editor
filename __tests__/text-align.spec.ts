/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_ALIGN, TEXT_ALIGNS, textAlign } from '../lib/editor/text-align.ts'

describe('textAlign', () => {
	it('keeps every alignment it offers', () => {
		for (const align of TEXT_ALIGNS) {
			expect(textAlign(align)).toBe(align)
		}
	})

	it('falls back for text made before alignment existed', () => {
		expect(textAlign(undefined)).toBe(DEFAULT_ALIGN)
	})

	it('falls back for a value it does not know', () => {
		// A newer version, or a host that has edited the state by hand
		expect(textAlign('justify' as never)).toBe(DEFAULT_ALIGN)
		expect(textAlign('' as never)).toBe(DEFAULT_ALIGN)
	})

	it('defaults to the alignment text already had', () => {
		expect(DEFAULT_ALIGN).toBe('left')
	})
})
