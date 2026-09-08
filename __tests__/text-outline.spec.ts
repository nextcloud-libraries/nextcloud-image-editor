/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { describe, expect, it } from 'vitest'
import { outlineColor, outlineWidth } from '../lib/editor/text-outline.ts'

describe('outlineColor', () => {
	it('puts a white edge on dark text', () => {
		expect(outlineColor('#000000')).toBe('#ffffff')
		expect(outlineColor('#1a1a2e')).toBe('#ffffff')
	})

	it('puts a black edge on light text', () => {
		expect(outlineColor('#ffffff')).toBe('#000000')
		expect(outlineColor('#ffe066')).toBe('#000000')
	})

	it('judges by luma rather than by the biggest channel', () => {
		// Pure blue is dark despite being fully saturated, pure green is not
		expect(outlineColor('#0000ff')).toBe('#ffffff')
		expect(outlineColor('#00ff00')).toBe('#000000')
	})

	it('falls back to black for something that is not a hex colour', () => {
		expect(outlineColor('rebeccapurple')).toBe('#000000')
	})
})

describe('outlineWidth', () => {
	it('scales with the text, so the weight looks the same at any size', () => {
		expect(outlineWidth(24)).toBe(3)
		expect(outlineWidth(96)).toBe(12)
	})

	it('never disappears on small text', () => {
		expect(outlineWidth(8)).toBe(1)
		expect(outlineWidth(1)).toBe(1)
	})
})
