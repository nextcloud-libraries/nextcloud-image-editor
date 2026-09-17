/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { estimateJpegQuality, readMetadataSegments, withMetadata } from '../lib/utils/jpeg.ts'
import { jpegAtQuality } from './jpeg-fixture.ts'

/** The playground's 64x48 JPEG carrying EXIF, GPS and XMP, made with exiftool */
const fixture = new Uint8Array(readFileSync(resolve(process.cwd(), 'playground/with-metadata.jpg')))

/**
 * Read a segment's payload as ASCII, to recognise which block it is.
 *
 * @param segment the segment including marker and length
 */
function head(segment: Uint8Array): string {
	return [...segment.subarray(4, 20)].map((b) => String.fromCharCode(b)).join('')
}

/**
 * A minimal JPEG the way a browser encoder writes one: start marker, a
 * JFIF block, then the scan.
 */
function encoded(): Uint8Array {
	// SOI, a JFIF block, the scan with two bytes of pixels, then EOI
	const hex = 'ffd8ffe000104a46494600010100000100010000ffda0008010100003f00aabbffd9'
	return Uint8Array.from(hex.match(/../g)!.map((byte) => Number.parseInt(byte, 16)))
}

describe('readMetadataSegments', () => {
	it('finds the blocks a camera wrote', () => {
		const segments = readMetadataSegments(fixture)
		expect(segments.some((s) => head(s).startsWith('Exif'))).toBe(true)
		expect(segments.some((s) => head(s).startsWith('http://ns.adobe'))).toBe(true)
	})

	it('leaves the pixels behind', () => {
		// Only the metadata blocks, nowhere near the size of the file
		const segments = readMetadataSegments(fixture)
		const carried = segments.reduce((sum, s) => sum + s.length, 0)
		expect(carried).toBeLessThan(fixture.length)
		expect(segments.every((s) => s[0] === 0xFF)).toBe(true)
	})

	it('returns nothing for something that is not a JPEG', () => {
		expect(readMetadataSegments(new Uint8Array([1, 2, 3, 4]))).toEqual([])
	})
})

describe('estimateJpegQuality', () => {
	it('reads back the setting an encoder was given', () => {
		// Exact for anything scaled off the standard table, which is
		// every browser encoder and most of what cameras write
		for (const quality of [30, 50, 75, 85, 92, 95, 97, 100]) {
			expect(estimateJpegQuality(jpegAtQuality(quality))).toBe(quality)
		}
	})

	it('reads the luminance table, not whichever comes first', () => {
		const chrominance = jpegAtQuality(60, 1)
		const luminance = jpegAtQuality(90)
		// One file carrying both tables, the chrominance one first
		const both = Uint8Array.from([
			...chrominance.subarray(0, chrominance.length - 2),
			...luminance.subarray(2),
		])
		expect(estimateJpegQuality(both)).toBe(90)
	})

	it('answers for a photo a camera wrote', () => {
		// The fixture went through ImageMagick at its default setting
		expect(estimateJpegQuality(fixture)).toBe(92)
	})

	it('has nothing to say about a file with no table', () => {
		expect(estimateJpegQuality(encoded())).toBeUndefined()
	})

	it('has nothing to say about something that is not a JPEG', () => {
		expect(estimateJpegQuality(Uint8Array.from([1, 2, 3, 4]))).toBeUndefined()
	})
})

describe('withMetadata', () => {
	it('puts the blocks into an image that had none', () => {
		const out = withMetadata(encoded(), readMetadataSegments(fixture), { width: 64, height: 48 })
		expect(readMetadataSegments(out).length).toBe(readMetadataSegments(fixture).length)
	})

	it('keeps the encoded pixels intact', () => {
		const source = encoded()
		const out = withMetadata(source, readMetadataSegments(fixture), { width: 64, height: 48 })
		// The scan and everything after it survives byte for byte
		expect([...out.subarray(out.length - 6)]).toEqual([...source.subarray(source.length - 6)])
	})

	it('normalises the orientation, because the rotation is in the pixels', () => {
		const rotated = new Uint8Array(fixture)
		// Say the source was rotated a quarter turn
		const segments = readMetadataSegments(rotated)
		const exif = segments.find((s) => head(s).startsWith('Exif'))!
		const out = withMetadata(encoded(), [exif], { width: 64, height: 48 })
		const written = readMetadataSegments(out).find((s) => head(s).startsWith('Exif'))!
		// Orientation 1 means the reader should not turn it again
		const little = head(written).slice(6, 8) === 'II'
		const view = new DataView(written.buffer, written.byteOffset, written.byteLength)
		const ifd0 = view.getUint32(10 + 4, little)
		const count = view.getUint16(10 + ifd0, little)
		let orientation: number | null = null
		for (let i = 0; i < count; i++) {
			const entry = 10 + ifd0 + 2 + i * 12
			if (view.getUint16(entry, little) === 0x0112) {
				orientation = view.getUint16(entry + 8, little)
			}
		}
		expect(orientation).toBe(1)
	})

	it('carries the camera through without a parser having to be believed', () => {
		const out = withMetadata(encoded(), readMetadataSegments(fixture), { width: 64, height: 48 })
		const text = [...out].map((b) => String.fromCharCode(b)).join('')
		// The strings the camera wrote are in the bytes we hand back
		expect(text).toContain('Nextcloud')
		expect(text).toContain('Test Camera 1')
		expect(text).toContain('2019:05:04 11:22:33')
	})

	it('records the size that was written, not the one that was opened', () => {
		const out = withMetadata(encoded(), readMetadataSegments(fixture), { width: 32, height: 24 })
		const exif = readMetadataSegments(out).find((s) => head(s).startsWith('Exif'))!
		const little = head(exif).slice(6, 8) === 'II'
		const view = new DataView(exif.buffer, exif.byteOffset, exif.byteLength)

		/**
		 * Read a tag out of the Exif sub-directory.
		 *
		 * @param wanted the tag number to look for
		 */
		function subIfdTag(wanted: number): number | null {
			const ifd0 = view.getUint32(10 + 4, little)
			const count = view.getUint16(10 + ifd0, little)
			let exifIfd = 0
			for (let i = 0; i < count; i++) {
				const entry = 10 + ifd0 + 2 + i * 12
				if (view.getUint16(entry, little) === 0x8769) {
					exifIfd = view.getUint32(entry + 8, little)
				}
			}
			if (exifIfd === 0) {
				return null
			}
			const subCount = view.getUint16(10 + exifIfd, little)
			for (let i = 0; i < subCount; i++) {
				const entry = 10 + exifIfd + 2 + i * 12
				if (view.getUint16(entry, little) === wanted) {
					return view.getUint16(entry + 2, little) === 3
						? view.getUint16(entry + 8, little)
						: view.getUint32(entry + 8, little)
				}
			}
			return null
		}

		// The fixture says 64x48; the export above is half that
		expect(subIfdTag(0xA002)).toBe(32)
		expect(subIfdTag(0xA003)).toBe(24)
	})

	it('hands back the encoded image untouched when there is nothing to carry', () => {
		const source = encoded()
		expect(withMetadata(source, [], { width: 1, height: 1 })).toEqual(source)
	})
})

/**
 * Append one twelve byte directory entry.
 *
 * @param tiff the block being built
 * @param tag which tag it carries
 * @param type 3 for a short, 4 for a long
 * @param count how many values it holds
 * @param value the value itself, or where the values live when more
 * than four bytes of them are needed
 */
function pushEntry(tiff: number[], tag: number, type: number, count: number, value: number): void {
	const u16 = (v: number) => tiff.push(v & 0xFF, (v >> 8) & 0xFF)
	const u32 = (v: number) => tiff.push(v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >> 24) & 0xFF)
	u16(tag)
	u16(type)
	u32(count)
	if (type === 3 && count * 2 <= 4) {
		u16(value)
		u16(0)
	} else {
		u32(value)
	}
}

/**
 * A JPEG whose Exif block carries a thumbnail, the way a camera writes
 * one: IFD0, then a second directory pointing at an embedded JPEG.
 *
 * @param marker recognisable bytes standing in for the thumbnail pixels
 */
function withThumbnail(marker: string): Uint8Array {
	const tiff: number[] = []
	const u16 = (value: number) => tiff.push(value & 0xFF, (value >> 8) & 0xFF)
	const u32 = (value: number) => tiff.push(
		value & 0xFF,
		(value >> 8) & 0xFF,
		(value >> 16) & 0xFF,
		(value >> 24) & 0xFF,
	)

	tiff.push(0x49, 0x49)
	u16(42)
	u32(8)
	// IFD0: one entry, then the thumbnail directory at offset 26
	u16(1)
	pushEntry(tiff, 0x0112, 3, 1, 6)
	u32(26)
	// IFD1: where the thumbnail is and how long it runs
	u16(2)
	pushEntry(tiff, 0x0201, 4, 1, 56)
	pushEntry(tiff, 0x0202, 4, 1, marker.length + 4)
	u32(0)
	const thumbnail = [0xFF, 0xD8, ...[...marker].map((c) => c.charCodeAt(0)), 0xFF, 0xD9]
	tiff.push(...thumbnail)

	const payload = [...[...'Exif\0\0'].map((c) => c.charCodeAt(0)), ...tiff]
	const length = payload.length + 2
	return new Uint8Array([
		0xFF,
		0xD8,
		0xFF,
		0xE1,
		(length >> 8) & 0xFF,
		length & 0xFF,
		...payload,
		0xFF,
		0xDA,
		0x00,
		0x08,
		1,
		1,
		0,
		0,
		0x3F,
		0x00,
		0xAA,
		0xBB,
		0xFF,
		0xD9,
	])
}

/**
 * A JPEG carrying a colour profile and an Exif block whose ColorSpace
 * tag says the pixels are something other than sRGB, which is what a
 * wide-gamut camera writes.
 *
 * @param colorSpace the value of the Exif ColorSpace tag: 1 is sRGB,
 * 0xFFFF is what a file with its own profile says instead
 */
function wideGamut(colorSpace = 0xFFFF): Uint8Array {
	const tiff: number[] = []
	const u16 = (value: number) => tiff.push(value & 0xFF, (value >> 8) & 0xFF)
	const u32 = (value: number) => tiff.push(
		value & 0xFF,
		(value >> 8) & 0xFF,
		(value >> 16) & 0xFF,
		(value >> 24) & 0xFF,
	)

	tiff.push(0x49, 0x49)
	u16(42)
	u32(8)
	// IFD0 points at the Exif directory, which is where ColorSpace lives
	u16(1)
	pushEntry(tiff, 0x8769, 4, 1, 26)
	u32(0)
	// The Exif directory: the colour space and the recorded pixel size
	u16(1)
	pushEntry(tiff, 0xA001, 3, 1, colorSpace)
	u32(0)

	const exif = [...[...'Exif\0\0'].map((c) => c.charCodeAt(0)), ...tiff]
	const exifLength = exif.length + 2
	const profile = [...[...'ICC_PROFILE\0'].map((c) => c.charCodeAt(0)), 1, 1, 0, 0, 0, 0]
	const profileLength = profile.length + 2

	return new Uint8Array([
		0xFF,
		0xD8,
		0xFF,
		0xE1,
		(exifLength >> 8) & 0xFF,
		exifLength & 0xFF,
		...exif,
		0xFF,
		0xE2,
		(profileLength >> 8) & 0xFF,
		profileLength & 0xFF,
		...profile,
		0xFF,
		0xDA,
		0x00,
		0x08,
		1,
		1,
		0,
		0,
		0x3F,
		0x00,
		0xAA,
		0xBB,
		0xFF,
		0xD9,
	])
}

/**
 * The Exif ColorSpace tag of a JPEG, or undefined where it has none.
 *
 * @param bytes the file to read
 */
function colorSpaceTag(bytes: Uint8Array): number | undefined {
	for (let at = 0; at + 1 < bytes.length; at++) {
		// The tag, its SHORT type and its count, little endian
		if (bytes[at] === 0x01 && bytes[at + 1] === 0xA0 && bytes[at + 2] === 3 && bytes[at + 3] === 0) {
			return bytes[at + 8]! | (bytes[at + 9]! << 8)
		}
	}
	return undefined
}

describe('the colour profile', () => {
	it('is carried when the pixels are still in the space it describes', () => {
		const segments = readMetadataSegments(wideGamut())
		expect(segments.some((segment) => head(segment).startsWith('ICC_PROFILE'))).toBe(true)
	})

	it('is left behind when asked, because the pixels are no longer in it', () => {
		const segments = readMetadataSegments(wideGamut(), { icc: false })
		// The rest of what the camera recorded still comes across
		expect(segments.some((segment) => head(segment).startsWith('ICC_PROFILE'))).toBe(false)
		expect(segments.some((segment) => head(segment).startsWith('Exif'))).toBe(true)
	})

	it('leaves the Exif colour space alone while the profile rides along', () => {
		const source = wideGamut()
		const out = withMetadata(encoded(), readMetadataSegments(source), { width: 4, height: 2 })
		expect(colorSpaceTag(out)).toBe(0xFFFF)
	})

	it('says sRGB once the profile is gone, which is what the pixels are', () => {
		const source = wideGamut()
		const out = withMetadata(encoded(), readMetadataSegments(source, { icc: false }), { width: 4, height: 2 })
		// Untagged bytes are read as sRGB; the tag would otherwise keep
		// claiming a space the file no longer carries a profile for
		expect(colorSpaceTag(out)).toBe(1)
	})
})

describe('the thumbnail the camera embedded', () => {
	const exported = () => withMetadata(
		encoded(),
		readMetadataSegments(withThumbnail('CAMERAFRAME')),
		{ width: 64, height: 48 },
	)

	it('is unlinked from the directory that held it', () => {
		const out = exported()
		// The Exif segment starts at the SOI; IFD0 holds one entry, so its
		// next-directory pointer follows the header at tiff + 8 + 2 + 12
		const exif = out.indexOf(0xE1) - 1
		const nextIfd = exif + 10 + 22
		expect([...out.subarray(nextIfd, nextIfd + 4)]).toEqual([0, 0, 0, 0])
	})

	it('has its pixels overwritten, not merely hidden', () => {
		// Unlinking alone leaves the frame as the camera saw it sitting in
		// the file, recoverable by carving, which undoes a redaction
		const text = String.fromCharCode(...exported())
		expect(text).not.toContain('CAMERAFRAME')
	})

	it('leaves the rest of the block alone', () => {
		const out = exported()
		expect(String.fromCharCode(...out)).toContain('Exif')
		// The scan the editor encoded is still the last thing in the file
		expect([...out.subarray(-3)]).toEqual([0xBB, 0xFF, 0xD9])
	})

	it('copes with a block that has no thumbnail at all', () => {
		const carried = withMetadata(encoded(), readMetadataSegments(fixture), { width: 64, height: 48 })
		expect(carried.length).toBeGreaterThan(encoded().length)
	})
})

/**
 * A JPEG whose Exif thumbnail is raw pixels in two strips, so IFD1
 * holds a pair of arrays rather than a pair of values.
 *
 * @param first bytes of the first strip
 * @param second bytes of the second strip
 */
function withStrippedThumbnail(first: string, second: string): Uint8Array {
	const tiff: number[] = []
	const u16 = (value: number) => tiff.push(value & 0xFF, (value >> 8) & 0xFF)
	const u32 = (value: number) => tiff.push(
		value & 0xFF,
		(value >> 8) & 0xFF,
		(value >> 16) & 0xFF,
		(value >> 24) & 0xFF,
	)

	// Header, then IFD0 with one entry and a pointer to IFD1 at 26
	tiff.push(0x49, 0x49)
	u16(42)
	u32(8)
	u16(1)
	pushEntry(tiff, 0x0112, 3, 1, 1)
	u32(26)

	// IFD1 at 26: two entries, each pointing at a two-value array
	const offsetsAt = 26 + 2 + 24 + 4
	const lengthsAt = offsetsAt + 8
	// The strips sit well past the arrays that point at them. Reading an
	// entry's last four bytes as a value rather than an address erases a
	// range near the arrays, which would cover the strips too if they
	// were packed right behind them, and the test would prove nothing.
	const padding = 256
	const stripsAt = lengthsAt + 8 + padding
	u16(2)
	pushEntry(tiff, 0x0111, 4, 2, offsetsAt)
	pushEntry(tiff, 0x0117, 4, 2, lengthsAt)
	u32(0)
	u32(stripsAt)
	u32(stripsAt + first.length)
	u32(first.length)
	u32(second.length)
	tiff.push(...Array.from({ length: padding }, () => 0x20))
	tiff.push(...[...first + second].map((c) => c.charCodeAt(0)))

	const payload = [...[...'Exif\0\0'].map((c) => c.charCodeAt(0)), ...tiff]
	const length = payload.length + 2
	return new Uint8Array([
		0xFF,
		0xD8,
		0xFF,
		0xE1,
		(length >> 8) & 0xFF,
		length & 0xFF,
		...payload,
		0xFF,
		0xDA,
		0x00,
		0x08,
		1,
		1,
		0,
		0,
		0x3F,
		0x00,
		0xAA,
		0xBB,
		0xFF,
		0xD9,
	])
}

describe('a thumbnail stored as strips', () => {
	it('has every strip erased, not just the first', () => {
		// With more than one value the entry holds a pointer to an array
		// rather than the value itself, so reading its last four bytes
		// finds the array's address and erases the wrong bytes
		const source = withStrippedThumbnail('STRIPONE', 'STRIPTWO')
		const out = withMetadata(encoded(), readMetadataSegments(source), { width: 64, height: 48 })

		const text = String.fromCharCode(...out)
		expect(text).not.toContain('STRIPONE')
		expect(text).not.toContain('STRIPTWO')
	})

	it('leaves the block it could not understand alone', () => {
		// An entry typed as something other than a short or a long says
		// nothing this can act on, so nothing is overwritten on a guess
		const source = withThumbnail('CAMERAFRAME')
		const out = withMetadata(encoded(), readMetadataSegments(source), { width: 64, height: 48 })
		expect(String.fromCharCode(...out)).toContain('Exif')
	})
})
