/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/** Start and end of a JPEG, and the marker that ends the header */
const SOI = 0xD8
const SOS = 0xDA
const EOI = 0xD9

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
const TAG_EXIF_IFD = 0x8769
const TAG_PIXEL_WIDTH = 0xA002
const TAG_PIXEL_HEIGHT = 0xA003

/** Where a thumbnail's pixels live, compressed or as strips */
const TAG_STRIP_OFFSETS = 0x0111
const TAG_STRIP_LENGTHS = 0x0117
const TAG_THUMBNAIL_OFFSET = 0x0201
const TAG_THUMBNAIL_LENGTH = 0x0202

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
 */
export function readMetadataSegments(bytes: Uint8Array): Uint8Array[] {
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
		if (isMetadata(marker, ascii(bytes, at + 4, 30))) {
			segments.push(bytes.subarray(at, at + 2 + length))
		}
		at += 2 + length
	}
	return segments
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
 * @param out the Exif segment, modified in place
 * @param tiff where the TIFF header starts within the segment
 * @param ifd1 the thumbnail directory's offset, relative to that header
 * @param eachEntry walker over one directory's entries
 * @param u16 reads a 16 bit value in the block's byte order
 * @param u32 reads a 32 bit value in the block's byte order
 */
function eraseThumbnail(
	out: Uint8Array,
	tiff: number,
	ifd1: number,
	eachEntry: (offset: number, visit: (entry: number, tag: number) => void) => number,
	u16: (at: number) => number,
	u32: (at: number) => number,
): void {
	if (ifd1 === 0) {
		return
	}
	let at = 0
	let length = 0
	eachEntry(ifd1, (entry, tag) => {
		// A thumbnail is a whole JPEG, or, rarely, one strip of raw
		// pixels. Either way one tag says where and another how far.
		if (tag === TAG_THUMBNAIL_OFFSET || tag === TAG_STRIP_OFFSETS) {
			at = u16(entry + 2) === 3 ? u16(entry + 8) : u32(entry + 8)
		}
		if (tag === TAG_THUMBNAIL_LENGTH || tag === TAG_STRIP_LENGTHS) {
			length = u16(entry + 2) === 3 ? u16(entry + 8) : u32(entry + 8)
		}
	})
	if (at === 0 || length === 0) {
		return
	}
	const from = Math.min(tiff + at, out.length)
	out.fill(0, from, Math.min(from + length, out.length))
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
 */
function rewriteExif(segment: Uint8Array, size: { width: number, height: number }): Uint8Array {
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
		eraseThumbnail(out, tiff, u32(endOfIfd0), eachEntry, u16, u32)
		view.setUint32(endOfIfd0, 0, little)
	}

	if (exifIfd !== 0) {
		eachEntry(exifIfd, (entry, tag) => {
			const type = u16(entry + 2)
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

	const carried = segments.map((segment) => (
		ascii(segment, 4, 6) === EXIF_HEADER ? rewriteExif(segment, size) : segment
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
