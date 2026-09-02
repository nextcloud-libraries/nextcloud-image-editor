/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { describe, expect, it } from 'vitest'
import { ownsSpaceKey, ownsTextEntry } from '../lib/utils/dom.ts'

/**
 * Build a detached element from markup and return its first child.
 *
 * @param markup the element markup
 */
function element(markup: string): HTMLElement {
	const host = document.createElement('div')
	host.innerHTML = markup
	return host.firstElementChild as HTMLElement
}

describe('ownsTextEntry', () => {
	it('claims text controls', () => {
		expect(ownsTextEntry(element('<input type="text">'))).toBe(true)
		expect(ownsTextEntry(element('<textarea></textarea>'))).toBe(true)
		expect(ownsTextEntry(element('<div contenteditable="true"><span>x</span></div>').firstElementChild)).toBe(true)
	})

	it('leaves buttons and plain elements alone', () => {
		expect(ownsTextEntry(element('<button>ok</button>'))).toBe(false)
		expect(ownsTextEntry(element('<div></div>'))).toBe(false)
		expect(ownsTextEntry(null)).toBe(false)
	})
})

describe('ownsSpaceKey', () => {
	it('claims controls the space bar activates', () => {
		expect(ownsSpaceKey(element('<button>ok</button>'))).toBe(true)
		expect(ownsSpaceKey(element('<a href="#">link</a>'))).toBe(true)
		expect(ownsSpaceKey(element('<span role="button">go</span>'))).toBe(true)
	})

	it('claims text controls too', () => {
		expect(ownsSpaceKey(element('<input type="text">'))).toBe(true)
	})

	it('leaves the canvas free to use space as a modifier', () => {
		expect(ownsSpaceKey(element('<div class="canvas"></div>'))).toBe(false)
		expect(ownsSpaceKey(null)).toBe(false)
	})
})
