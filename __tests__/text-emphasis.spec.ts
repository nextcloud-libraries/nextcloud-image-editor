/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { describe, expect, it } from 'vitest'
import { fontStyle, textDecoration } from '../lib/editor/text-emphasis.ts'

describe('fontStyle', () => {
	it('is normal for text made before emphasis existed', () => {
		expect(fontStyle({})).toBe('normal')
		expect(fontStyle({ bold: false, italic: false })).toBe('normal')
	})

	it('names each switch on its own', () => {
		expect(fontStyle({ bold: true })).toBe('bold')
		expect(fontStyle({ italic: true })).toBe('italic')
	})

	it('puts the slant first when both are on, as the font shorthand wants', () => {
		expect(fontStyle({ bold: true, italic: true })).toBe('italic bold')
	})
})

describe('textDecoration', () => {
	it('is empty for text made before emphasis existed', () => {
		expect(textDecoration({})).toBe('')
		expect(textDecoration({ underline: false, strikethrough: false })).toBe('')
	})

	it('names each line on its own', () => {
		expect(textDecoration({ underline: true })).toBe('underline')
		expect(textDecoration({ strikethrough: true })).toBe('line-through')
	})

	it('draws both lines when both are on', () => {
		expect(textDecoration({ underline: true, strikethrough: true })).toBe('underline line-through')
	})
})
