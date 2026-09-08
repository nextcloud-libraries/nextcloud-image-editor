/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_REDACT_SHAPE, REDACT_SHAPES, redactShape } from '../lib/editor/redact-shape.ts'

describe('redactShape', () => {
	it('keeps every outline it offers', () => {
		for (const shape of REDACT_SHAPES) {
			expect(redactShape(shape)).toBe(shape)
		}
	})

	it('falls back for redactions made before the choice existed', () => {
		expect(redactShape(undefined)).toBe(DEFAULT_REDACT_SHAPE)
	})

	it('falls back for an outline it does not know', () => {
		expect(redactShape('freehand' as never)).toBe(DEFAULT_REDACT_SHAPE)
	})

	it('leaves the rectangle as the default, so existing redactions are unchanged', () => {
		expect(DEFAULT_REDACT_SHAPE).toBe('rectangle')
	})
})
