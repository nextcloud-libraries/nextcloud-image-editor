/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Orientation } from './orientation.ts'

import { DEFAULT_ORIENTATION, isOrientation } from './orientation.ts'

/** Start and end of a JPEG, and the marker that ends the header */
const SOI = 0xD8
const SOS = 0xDA
const EOI = 0xD9

/** The segment carrying a quantization table */
const DQT = 0xDB

/** The application segments worth carrying from one JPEG to the next */
const APP1 = 0xE1
const APP2 = 0xE2
const APP13 = 0xED

/** What each of those segments announces itself as */
const EXIF_HEADER = 'Exif\0\0'
const XMP_HEADER = 'http://ns.adobe.com/xap/1.0/\0'
const ICC_HEADER = 'ICC_PROFILE\0'
const IPTC_HEADER = 'Photoshop 3.0\0'

/** TIFF tags this module rewrites rather than copies */
const TAG_ORIENTATION = 0x0112
const TAG_COLOR_SPACE = 0xA001
const TAG_EXIF_IFD = 0x8769
const TAG_PIXEL_WIDTH = 0xA002
const TAG_PIXEL_HEIGHT = 0xA003

/** The TIFF type of a tag holding one 16-bit number, which orientation is */
const TYPE_SHORT = 3

/**
 * A tag the format requires every directory of a JPEG to carry, so one
 * written from nothing has to include it. Centred, which is what a JPEG
 * written by anything this decade uses.
 */
const TAG_YCBCR_POSITIONING = 0x0213
const YCBCR_CENTERED = 1

/** Where a thumbnail's pixels live, compressed or as strips */
const TAG_STRIP_OFFSETS = 0x0111
const TAG_STRIP_LENGTHS = 0x0117
const TAG_THUMBNAIL_OFFSET = 0x0201
const TAG_THUMBNAIL_LENGTH = 0x0202

/**
 * The luminance quantization table of the JPEG standard, Annex K, in
 * the zigzag order a DQT segment stores. An encoder scales this table
 * to reach a quality setting, so a file's own table is what says which
 * setting it was written at.
 */
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
 * Read the leading bytes of a segment as ASCII, to recognise it.
 *
 * @param bytes the whole file
 * @param start where the segment payload begins
 * @param length how many bytes to read
 */
function ascii(bytes: Uint8Array, start: number, length: number): string {
	let out = ''
	for (let i = 0; i < length && start + i < bytes.length; i++) {
		out += String.fromCharCode(bytes[start + i]!)
	}
	return out
}

/**
 * Whether a segment is one of the metadata blocks worth carrying.
 *
 * @param marker the segment marker
 * @param head the first bytes of its payload
 */
function isMetadata(marker: number, head: string): boolean {
	if (marker === APP1) {
		return head.startsWith(EXIF_HEADER) || head.startsWith(XMP_HEADER.slice(0, 20))
	}
	if (marker === APP2) {
		return head.startsWith(ICC_HEADER)
	}
	if (marker === APP13) {
		return head.startsWith(IPTC_HEADER)
	}
	return false
}

/**
 * The metadata segments of a JPEG, whole and in the order they appeared,
 * each including its marker and length so it can be written back as is.
 *
 * Anything that is not metadata is left behind: the pixels of the export
 * are the editor's, not the source's.
 *
 * @param bytes the source JPEG
 * @param options what to carry
 * @param options.icc whether to carry the colour profile, which belongs
 * to the export only while its pixels are still in the space that
 * profile describes
 */
export function readMetadataSegments(bytes: Uint8Array, options: { icc?: boolean } = {}): Uint8Array[] {
	const { icc = true } = options
	if (bytes[0] !== 0xFF || bytes[1] !== SOI) {
		return []
	}
	const segments: Uint8Array[] = []
	let at = 2
	while (at + 3 < bytes.length && bytes[at] === 0xFF) {
		const marker = bytes[at + 1]!
		// The scan carries the pixels and runs to the end: nothing past
		// here is metadata
		if (marker === SOS || marker === EOI) {
			break
		}
		const length = (bytes[at + 2]! << 8) | bytes[at + 3]!
		const head = ascii(bytes, at + 4, 30)
		if (isMetadata(marker, head) && (icc || !head.startsWith(ICC_HEADER))) {
			segments.push(bytes.subarray(at, at + 2 + length))
		}
		at += 2 + length
	}
	return segments
}

/**
 * The luminance quantization table of a JPEG, in the order it is
 * stored, or undefined where the file carries none.
 *
 * @param bytes the source JPEG
 */
function readLuminanceTable(bytes: Uint8Array): number[] | undefined {
	if (bytes[0] !== 0xFF || bytes[1] !== SOI) {
		return undefined
	}
	let at = 2
	while (at + 3 < bytes.length && bytes[at] === 0xFF) {
		const marker = bytes[at + 1]!
		if (marker === SOS || marker === EOI) {
			break
		}
		const length = (bytes[at + 2]! << 8) | bytes[at + 3]!
		if (marker === DQT) {
			// One segment can hold several tables, each introduced by a
			// byte giving its precision and its id: 0 is the luminance
			// table, which is the one a quality setting is read from
			const end = at + 2 + length
			let entry = at + 4
			while (entry < end) {
				const width = (bytes[entry]! >> 4) === 0 ? 1 : 2
				if (entry + 1 + 64 * width > end) {
					break
				}
				if ((bytes[entry]! & 0x0F) === 0) {
					const values = entry + 1
					return Array.from({ length: 64 }, (_, index) => {
						const value = values + index * width
						return width === 1 ? bytes[value]! : (bytes[value]! << 8) | bytes[value + 1]!
					})
				}
				entry += 1 + 64 * width
			}
		}
		at += 2 + length
	}
	return undefined
}

/**
 * The table libjpeg writes for a quality setting, which is what the
 * browser encoders are built on.
 *
 * @param quality the setting, 1 to 100
 */
function scaledTable(quality: number): number[] {
	const scale = quality < 50 ? Math.floor(5000 / quality) : 200 - quality * 2
	return STANDARD_LUMINANCE.map((value) => (
		Math.min(255, Math.max(1, Math.floor((value * scale + 50) / 100)))
	))
}

/**
 * The quality setting a JPEG was written at, 1 to 100, or undefined
 * where it carries no quantization table to judge by.
 *
 * The setting is not recorded anywhere; what the file keeps is the
 * table the setting produced. So every candidate table is generated
 * and the closest one wins: exact for anything an IJG-derived encoder
 * wrote, the browsers included, and the nearest fit for a camera that
 * tuned a table of its own.
 *
 * @param bytes the source JPEG
 */
export function estimateJpegQuality(bytes: Uint8Array): number | undefined {
	const table = readLuminanceTable(bytes)
	if (table === undefined) {
		return undefined
	}
	let best = 1
	let smallest = Infinity
	for (let quality = 1; quality <= 100; quality++) {
		const candidate = scaledTable(quality)
		let distance = 0
		for (let index = 0; index < 64; index++) {
			distance += Math.abs(candidate[index]! - table[index]!)
		}
		if (distance < smallest) {
			smallest = distance
			best = quality
		}
	}
	return best
}

/**
 * Overwrite the pixels of the thumbnail an Exif block carries.
 *
 * The bytes are zeroed where they lie rather than cut out, because
 * every offset in the block is measured from the start of the TIFF
 * header: removing bytes would move everything after them and break
 * the tags that point there. Zeroing costs a few unused kilobytes in
 * the file and cannot corrupt it.
 *
 * A thumbnail is usually one whole JPEG, named by a single pair of
 * tags. It may also be raw pixels in strips, and then there is one
 * offset and one length per strip, so every pair has to be erased.
 *
 * @param out the Exif segment, modified in place
 * @param tiff where the TIFF header starts within the segment
 * @param ifd1 the thumbnail directory's offset, relative to that header
 * @param eachEntry walker over one directory's entries
 * @param values reads everything one entry carries
 */
function eraseThumbnail(
	out: Uint8Array,
	tiff: number,
	ifd1: number,
	eachEntry: (offset: number, visit: (entry: number, tag: number) => void) => number,
	values: (entry: number) => number[],
): void {
	if (ifd1 === 0) {
		return
	}
	let offsets: number[] = []
	let lengths: number[] = []
	eachEntry(ifd1, (entry, tag) => {
		if (tag === TAG_THUMBNAIL_OFFSET || tag === TAG_STRIP_OFFSETS) {
			offsets = values(entry)
		}
		if (tag === TAG_THUMBNAIL_LENGTH || tag === TAG_STRIP_LENGTHS) {
			lengths = values(entry)
		}
	})
	for (let i = 0; i < Math.min(offsets.length, lengths.length); i++) {
		const from = Math.min(tiff + offsets[i]!, out.length)
		out.fill(0, from, Math.min(from + lengths[i]!, out.length))
	}
}

/**
 * Rewrite the parts of an Exif segment that the edit has made untrue.
 *
 * The orientation is baked into the pixels the editor exports, so a tag
 * saying to rotate them again would turn the image twice. The embedded
 * thumbnail is the one the camera made, which is no longer the picture:
 * its pixels are overwritten and the directory holding it is unlinked.
 * The recorded pixel size is replaced with the size actually written.
 *
 * @param segment an APP1 segment starting with the Exif header
 * @param size the size of the exported image
 * @param size.width the exported width in pixels
 * @param size.height the exported height in pixels
 * @param srgb whether the pixels are sRGB, which is what they are
 * whenever no profile came with them
 */
function rewriteExif(segment: Uint8Array, size: { width: number, height: number }, srgb: boolean): Uint8Array {
	const out = new Uint8Array(segment)
	// marker (2) + length (2) + "Exif\0\0" (6)
	const tiff = 10
	if (out.length < tiff + 8) {
		return out
	}
	const little = ascii(out, tiff, 2) === 'II'
	const view = new DataView(out.buffer, out.byteOffset, out.byteLength)
	const u16 = (at: number) => view.getUint16(at, little)
	const u32 = (at: number) => view.getUint32(at, little)
	const setU16 = (at: number, value: number) => view.setUint16(at, value, little)

	/**
	 * Walk one image file directory, handing each entry to the caller.
	 *
	 * @param offset where the directory starts, relative to the TIFF header
	 * @param visit called with the absolute position of every entry
	 */
	function eachEntry(offset: number, visit: (entry: number, tag: number) => void): number {
		const start = tiff + offset
		if (start + 2 > out.length) {
			return start
		}
		const count = u16(start)
		for (let i = 0; i < count; i++) {
			const entry = start + 2 + i * 12
			if (entry + 12 > out.length) {
				break
			}
			visit(entry, u16(entry))
		}
		return start + 2 + count * 12
	}

	/**
	 * Everything one entry carries, whether it fits in the entry or not.
	 *
	 * An entry keeps its values in its last four bytes when they fit
	 * there and a pointer to them when they do not, so anything with
	 * more than one value, such as a thumbnail split across strips,
	 * lives elsewhere in the block. Reading those four bytes as a value
	 * would take the array's address for a strip's own.
	 *
	 * @param entry the absolute position of the entry
	 */
	function entryValues(entry: number): number[] {
		const type = u16(entry + 2)
		if (type !== 3 && type !== 4) {
			return []
		}
		const width = type === 3 ? 2 : 4
		const count = u32(entry + 4)
		const base = count * width <= 4 ? entry + 8 : tiff + u32(entry + 8)
		const found: number[] = []
		for (let i = 0; i < count; i++) {
			const at = base + i * width
			if (at + width > out.length) {
				break
			}
			found.push(width === 2 ? u16(at) : u32(at))
		}
		return found
	}

	const ifd0 = u32(tiff + 4)
	let exifIfd = 0
	const endOfIfd0 = eachEntry(ifd0, (entry, tag) => {
		if (tag === TAG_ORIENTATION) {
			// Every rotation is already in the pixels
			setU16(entry + 8, 1)
		}
		if (tag === TAG_EXIF_IFD) {
			exifIfd = u32(entry + 8)
		}
	})

	// The next directory is the thumbnail's, and it is the old picture:
	// the frame as the camera saw it, before anything here was cropped
	// out or redacted. Unlinking the directory hides it from a reader,
	// but the pixels stay in the file and can be carved back out, so
	// they are overwritten before the link is cut.
	if (endOfIfd0 + 4 <= out.length) {
		eraseThumbnail(out, tiff, u32(endOfIfd0), eachEntry, entryValues)
		view.setUint32(endOfIfd0, 0, little)
	}

	if (exifIfd !== 0) {
		eachEntry(exifIfd, (entry, tag) => {
			const type = u16(entry + 2)
			// A file that says nothing about its colours is read as sRGB,
			// and with the profile gone that is what these are. Left alone
			// it would still claim whatever the camera captured in.
			if (tag === TAG_COLOR_SPACE && srgb && type === 3) {
				setU16(entry + 8, 1)
				return
			}
			const value = tag === TAG_PIXEL_WIDTH ? size.width : tag === TAG_PIXEL_HEIGHT ? size.height : null
			if (value === null) {
				return
			}
			// SHORT holds up to 65535; anything larger has to be a LONG
			if (type === 3 && value <= 0xFFFF) {
				setU16(entry + 8, value)
			} else if (type === 4) {
				view.setUint32(entry + 8, value, little)
			}
		})
	}

	return out
}

/**
 * Put the metadata of one JPEG into another, in place of whatever the
 * encoder wrote.
 *
 * The browser's encoder emits a bare JFIF file, so this inserts the
 * carried segments straight after the start marker and any JFIF block,
 * which is where readers expect them.
 *
 * @param encoded the JPEG the editor produced
 * @param segments the segments from {@link readMetadataSegments}
 * @param size the size of the encoded image, for the tags that record it
 * @param size.width the encoded width in pixels
 * @param size.height the encoded height in pixels
 */
export function withMetadata(
	encoded: Uint8Array,
	segments: Uint8Array[],
	size: { width: number, height: number },
): Uint8Array {
	if (segments.length === 0 || encoded[0] !== 0xFF || encoded[1] !== SOI) {
		return encoded
	}

	// Keep the encoder's own JFIF segment ahead of what we insert
	let at = 2
	while (at + 3 < encoded.length && encoded[at] === 0xFF) {
		const marker = encoded[at + 1]!
		if (marker === SOS || marker === EOI) {
			break
		}
		const length = (encoded[at + 2]! << 8) | encoded[at + 3]!
		const head = ascii(encoded, at + 4, 30)
		// Drop anything the encoder wrote that we are replacing
		if (isMetadata(marker, head)) {
			break
		}
		if (marker !== 0xE0) {
			break
		}
		at += 2 + length
	}

	// No profile among them means the pixels are sRGB: either the source
	// carried none, or it carried one the browser has already converted
	// away from
	const srgb = !segments.some((segment) => ascii(segment, 4, ICC_HEADER.length) === ICC_HEADER)
	const carried = segments.map((segment) => (
		ascii(segment, 4, 6) === EXIF_HEADER ? rewriteExif(segment, size, srgb) : segment
	))
	const total = carried.reduce((sum, segment) => sum + segment.length, 0)

	const out = new Uint8Array(encoded.length + total)
	out.set(encoded.subarray(0, at), 0)
	let write = at
	for (const segment of carried) {
		out.set(segment, write)
		write += segment.length
	}
	out.set(encoded.subarray(at), write)
	return out
}

/**
 * Where the Exif block of a JPEG is, if it has one.
 *
 * Only the first one counts: a reader takes the first Exif APP1 after the
 * start marker and ignores anything claiming to be a second.
 *
 * @param bytes the whole file
 * @return the offset of the marker and the segment's own length field
 */
function findExif(bytes: Uint8Array): { at: number, length: number } | null {
	if (bytes[0] !== 0xFF || bytes[1] !== SOI) {
		return null
	}
	let at = 2
	while (at + 3 < bytes.length && bytes[at] === 0xFF) {
		const marker = bytes[at + 1]!
		if (marker === SOS || marker === EOI) {
			return null
		}
		const length = (bytes[at + 2]! << 8) | bytes[at + 3]!
		if (marker === APP1 && ascii(bytes, at + 4, 6) === EXIF_HEADER) {
			return { at, length }
		}
		at += 2 + length
	}
	return null
}

/**
 * Everything needed to read or write the first directory of a TIFF block.
 *
 * @param bytes the whole file
 * @param tiff where the TIFF header starts within it
 * @param end where the block ends, so a directory outside it is refused
 */
function readIfd0(bytes: Uint8Array, tiff: number, end: number): {
	little: boolean
	view: DataView
	/** Where the entry count sits */
	start: number
	count: number
} | null {
	if (tiff + 8 > end) {
		return null
	}
	const order = ascii(bytes, tiff, 2)
	if (order !== 'II' && order !== 'MM') {
		return null
	}
	const little = order === 'II'
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
	const start = tiff + view.getUint32(tiff + 4, little)
	if (start < tiff + 8 || start + 2 > end) {
		return null
	}
	const count = view.getUint16(start, little)
	// A table running past the block is not one to walk, and one with no
	// entries has no next-directory pointer to carry either
	if (count === 0 || start + 2 + count * 12 + 4 > end) {
		return null
	}
	return { little, view, start, count }
}

/**
 * Where the orientation entry of a TIFF block sits, if it has one that
 * can be written in place.
 *
 * The tag is specified as a SHORT. One stored as anything else is left to
 * the slower path, which writes a fresh entry of the right type rather
 * than overwriting bytes whose meaning it has guessed.
 *
 * @param bytes the whole file
 * @param tiff where the TIFF header starts within it
 * @param end where the block ends
 */
function findOrientationEntry(bytes: Uint8Array, tiff: number, end: number): number | null {
	const ifd0 = readIfd0(bytes, tiff, end)
	if (ifd0 === null) {
		return null
	}
	const { little, view, start, count } = ifd0
	for (let i = 0; i < count; i++) {
		const entry = start + 2 + i * 12
		// A single SHORT is held in the entry itself. Any other count puts
		// the value elsewhere and those four bytes are a pointer, not a
		// number to overwrite
		if (view.getUint16(entry, little) === TAG_ORIENTATION
			&& view.getUint16(entry + 2, little) === TYPE_SHORT
			&& view.getUint32(entry + 4, little) === 1) {
			return entry
		}
	}
	return null
}

/**
 * The orientation a JPEG carries, or the default where it carries none.
 *
 * @param bytes the file to read
 */
export function readJpegOrientation(bytes: Uint8Array): Orientation {
	const exif = findExif(bytes)
	if (exif === null) {
		return DEFAULT_ORIENTATION
	}
	const tiff = exif.at + 10
	const entry = findOrientationEntry(bytes, tiff, exif.at + 2 + exif.length)
	if (entry === null) {
		return DEFAULT_ORIENTATION
	}
	const little = ascii(bytes, tiff, 2) === 'II'
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
	const value = view.getUint16(entry + 8, little)
	return isOrientation(value) ? value : DEFAULT_ORIENTATION
}

/**
 * An Exif block holding an orientation, for a file that had none to amend.
 *
 * It carries the positioning tag beside it because a directory without
 * that one does not validate, and a block a validator rejects is one some
 * reader will eventually reject too.
 *
 * @param orientation the value to record
 */
function newExifSegment(orientation: Orientation): Uint8Array {
	// marker, length, "Exif\0\0", TIFF header, two-entry directory, no next
	const segment = new Uint8Array(4 + 6 + 8 + 2 + 24 + 4)
	const view = new DataView(segment.buffer)
	segment[0] = 0xFF
	segment[1] = APP1
	view.setUint16(2, segment.length - 2)
	for (let i = 0; i < EXIF_HEADER.length; i++) {
		segment[4 + i] = EXIF_HEADER.charCodeAt(i)
	}
	const tiff = 10
	// "MM", the big-endian marker, then the answer to everything and the
	// offset of the first directory, which follows the header directly
	view.setUint16(tiff, 0x4D4D)
	view.setUint16(tiff + 2, 0x002A)
	view.setUint32(tiff + 4, 8)
	// Two entries, in the ascending tag order a reader is entitled to
	view.setUint16(tiff + 8, 2)
	writeShortEntry(view, tiff + 10, false, TAG_ORIENTATION, orientation)
	writeShortEntry(view, tiff + 22, false, TAG_YCBCR_POSITIONING, YCBCR_CENTERED)
	return segment
}

/**
 * Write a directory that has the entries of the old one plus an
 * orientation, at the end of the block rather than over the old one.
 *
 * Every offset in a TIFF block is measured from its header, so growing a
 * directory in place would move the values that follow it out from under
 * the tags pointing at them. Appending a whole new directory and pointing
 * the header at it moves nothing: the old entries keep their offsets, the
 * old table is left behind as a few dead bytes, and only the header's one
 * pointer changes.
 *
 * @param bytes the whole file
 * @param exif where the Exif segment is and how long it says it is
 * @param exif.at the offset of the segment's marker
 * @param exif.length the segment's own length field
 * @param orientation the value to record
 */
function withOrientationEntry(
	bytes: Uint8Array,
	exif: { at: number, length: number },
	orientation: Orientation,
): Uint8Array | null {
	const tiff = exif.at + 10
	const end = exif.at + 2 + exif.length
	const ifd0 = readIfd0(bytes, tiff, end)
	if (ifd0 === null) {
		return null
	}
	const { little, view, start, count } = ifd0

	const added = 2 + (count + 1) * 12 + 4
	// The length field counts itself and is 16 bits, so a block already
	// near the limit has no room for another directory
	if (exif.length + added > 0xFFFF) {
		return null
	}

	const out = new Uint8Array(bytes.length + added)
	out.set(bytes.subarray(0, end), 0)
	out.set(bytes.subarray(end), end + added)

	const write = new DataView(out.buffer)
	write.setUint16(exif.at + 2, exif.length + added)
	// The new directory sits where the block used to end
	write.setUint32(tiff + 4, end - tiff, little)
	write.setUint16(end, count + 1, little)

	// Entries are held in ascending tag order, so the new one goes where
	// the old table first runs past it
	let at = end + 2
	let written = false
	for (let i = 0; i < count; i++) {
		const entry = start + 2 + i * 12
		if (!written && view.getUint16(entry, little) > TAG_ORIENTATION) {
			at = writeShortEntry(write, at, little, TAG_ORIENTATION, orientation)
			written = true
		}
		out.set(bytes.subarray(entry, entry + 12), at)
		at += 12
	}
	if (!written) {
		at = writeShortEntry(write, at, little, TAG_ORIENTATION, orientation)
	}
	// Whatever the old directory pointed at next, the new one points at too
	write.setUint32(at, view.getUint32(start + 2 + count * 12, little), little)
	return out
}

/**
 * Write one entry holding a single SHORT and say where the next one goes.
 *
 * @param view the buffer being written
 * @param at where the entry starts
 * @param little whether the block is little-endian
 * @param tag the tag to record
 * @param value its value
 */
function writeShortEntry(
	view: DataView,
	at: number,
	little: boolean,
	tag: number,
	value: number,
): number {
	view.setUint16(at, tag, little)
	view.setUint16(at + 2, TYPE_SHORT, little)
	view.setUint32(at + 4, 1, little)
	// One SHORT fits in the four bytes an entry keeps for its value, and
	// sits at the front of them; the rest stay zero
	view.setUint16(at + 8, value, little)
	view.setUint16(at + 10, 0, little)
	return at + 12
}

/**
 * The same JPEG, recorded as being oriented some other way.
 *
 * Only the tag is touched. The scan is copied across byte for byte, so
 * the picture is not decoded, not re-encoded, and loses nothing: turning
 * an image this way costs the same whether it is done once or a hundred
 * times. Where the file already names an orientation this is a two-byte
 * write and the file does not even change length.
 *
 * @param bytes the file to amend
 * @param orientation the value to record
 * @return the amended file, or null where it could not be written
 */
export function setJpegOrientation(bytes: Uint8Array, orientation: Orientation): Uint8Array | null {
	if (!isOrientation(orientation)) {
		return null
	}
	if (bytes[0] !== 0xFF || bytes[1] !== SOI) {
		return null
	}

	const exif = findExif(bytes)
	if (exif === null) {
		// Exif has to be the first thing after the start marker
		const segment = newExifSegment(orientation)
		const out = new Uint8Array(bytes.length + segment.length)
		out.set(bytes.subarray(0, 2), 0)
		out.set(segment, 2)
		out.set(bytes.subarray(2), 2 + segment.length)
		return out
	}

	const entry = findOrientationEntry(bytes, exif.at + 10, exif.at + 2 + exif.length)
	if (entry === null) {
		return withOrientationEntry(bytes, exif, orientation)
	}

	const out = new Uint8Array(bytes)
	const little = ascii(bytes, exif.at + 10, 2) === 'II'
	new DataView(out.buffer).setUint16(entry + 8, orientation, little)
	return out
}
