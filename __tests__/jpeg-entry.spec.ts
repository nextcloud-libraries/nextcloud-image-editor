/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { describe, expect, it } from 'vitest'
import * as entry from '../lib/jpeg.ts'

describe('the jpeg entry point', () => {
	it('offers the turning API and nothing else', () => {
		// A host importing this one is asking for the bytes, not the
		// editor: anything else appearing here would come with Konva and a
		// stylesheet behind it
		expect(Object.keys(entry).sort()).toEqual([
			'DEFAULT_ORIENTATION',
			'isOrientation',
			'readJpegOrientation',
			'rotateOrientation',
			'setJpegOrientation',
		])
	})

	it('turns a file end to end', () => {
		const bare = Uint8Array.from('ffd8ffda0008010100003f00aabbffd9'.match(/../g)!
			.map((byte) => Number.parseInt(byte, 16)))
		const turned = entry.setJpegOrientation(bare, entry.rotateOrientation(
			entry.readJpegOrientation(bare),
			'left',
		))
		expect(entry.readJpegOrientation(turned!)).toBe(8)
	})
})
