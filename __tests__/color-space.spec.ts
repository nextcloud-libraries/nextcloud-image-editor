/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { convertsToSrgb, resetColorSpaceProbe } from '../lib/utils/color-space.ts'

/**
 * Stand in for a browser whose canvas answers with the given space, or
 * refuses the question altogether.
 *
 * @param colorSpace what getContextAttributes reports, or null to throw
 */
function browserReporting(colorSpace: string | null): void {
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
		if (colorSpace === null) {
			throw new Error('unsupported')
		}
		return { getContextAttributes: () => ({ colorSpace }) } as unknown as CanvasRenderingContext2D
	})
}

afterEach(() => {
	resetColorSpaceProbe()
	vi.restoreAllMocks()
})

describe('convertsToSrgb', () => {
	it('is true where a canvas can hold another colour space', () => {
		// Chromium: it holds display-p3, and converts what it decodes
		browserReporting('display-p3')
		expect(convertsToSrgb()).toBe(true)
	})

	it('is false where every canvas is sRGB whatever was asked for', () => {
		// Firefox: the request is ignored, and a decode is left untouched
		browserReporting('srgb')
		expect(convertsToSrgb()).toBe(false)
	})

	it('takes a refusal as a no', () => {
		browserReporting(null)
		expect(convertsToSrgb()).toBe(false)
	})

	it('asks once and remembers', () => {
		browserReporting('display-p3')
		convertsToSrgb()
		const after = vi.mocked(HTMLCanvasElement.prototype.getContext).mock.calls.length
		convertsToSrgb()
		expect(vi.mocked(HTMLCanvasElement.prototype.getContext).mock.calls.length).toBe(after)
	})
})
