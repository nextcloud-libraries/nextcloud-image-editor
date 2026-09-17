/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/** The standard luminance table, in the zigzag order a DQT stores */
const STANDARD_LUMINANCE = [
	16,
	11,
	12,
	14,
	12,
	10,
	16,
	14,
	13,
	14,
	18,
	17,
	16,
	19,
	24,
	40,
	26,
	24,
	22,
	22,
	24,
	49,
	35,
	37,
	29,
	40,
	58,
	51,
	61,
	60,
	57,
	51,
	56,
	55,
	64,
	72,
	92,
	78,
	64,
	68,
	87,
	69,
	55,
	56,
	80,
	109,
	81,
	87,
	95,
	98,
	103,
	104,
	103,
	62,
	77,
	113,
	121,
	112,
	100,
	120,
	92,
	101,
	103,
	99,
]

/**
 * A JPEG carrying nothing but the quantization table a quality setting
 * produces, which is all an estimate is read from. Encoding a real one
 * would need a canvas, and jsdom has none.
 *
 * @param quality the setting to write the table for, 1 to 100
 * @param id the table's id: 0 is luminance, 1 chrominance
 */
export function jpegAtQuality(quality: number, id = 0): Uint8Array {
	const scale = quality < 50 ? Math.floor(5000 / quality) : 200 - quality * 2
	const table = STANDARD_LUMINANCE.map((value) => (
		Math.min(255, Math.max(1, Math.floor((value * scale + 50) / 100)))
	))
	// Start marker, then a DQT whose length covers the id byte and the
	// 64 values, then the end marker
	const soi = [0xFF, 0xD8]
	const dqt = [0xFF, 0xDB, 0x00, 0x43, id]
	const eoi = [0xFF, 0xD9]
	return Uint8Array.from([...soi, ...dqt, ...table, ...eoi])
}

/**
 * The same bytes as a Blob the export can read, which jsdom's own
 * cannot be.
 *
 * @param quality the setting the source was written at, 1 to 100
 */
export function jpegBlobAtQuality(quality: number): Blob {
	const bytes = jpegAtQuality(quality)
	const buffer = new ArrayBuffer(bytes.length)
	new Uint8Array(buffer).set(bytes)
	const blob = new Blob([buffer], { type: 'image/jpeg' })
	Object.defineProperty(blob, 'arrayBuffer', { value: async () => buffer })
	return blob
}
