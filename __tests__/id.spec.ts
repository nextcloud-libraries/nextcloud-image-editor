/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { newId } from '../lib/utils/id.ts'

/** Restored after every test, since insecure contexts are simulated */
const platformUuid = crypto.randomUUID

/**
 * Take crypto.randomUUID away, as a non-secure context does.
 */
function withoutPlatformUuid(): void {
	Reflect.set(crypto, 'randomUUID', undefined)
}

describe('newId', () => {
	afterEach(() => {
		Reflect.set(crypto, 'randomUUID', platformUuid)
		vi.restoreAllMocks()
	})

	it('uses the platform uuid where it is available', () => {
		const uuid = vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-2222-3333-4444-555555555555')
		expect(newId()).toBe('11111111-2222-3333-4444-555555555555')
		expect(uuid).toHaveBeenCalledOnce()
	})

	it('falls back to random bytes in an insecure context', () => {
		withoutPlatformUuid()
		expect(newId()).toMatch(/^[0-9a-f]{32}$/)
	})

	it('does not repeat itself', () => {
		withoutPlatformUuid()
		const ids = new Set(Array.from({ length: 500 }, () => newId()))
		expect(ids.size).toBe(500)
	})
})
