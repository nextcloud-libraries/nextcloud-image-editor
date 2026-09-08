/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/** How thick the edge is relative to the glyphs it surrounds */
const OUTLINE_RATIO = 8

/**
 * The edge a caption is given so it survives whatever is behind it.
 *
 * It is derived rather than chosen: the point is contrast against the
 * text, and asking someone to pick a second colour that happens to
 * contrast is asking them to do the work themselves. Dark text takes a
 * white edge, light text a black one, which is the pair that reads on a
 * photograph of anything.
 *
 * @param color the colour the text is drawn in, as `#rrggbb`
 */
export function outlineColor(color: string): string {
	const hex = /^#?([0-9a-f]{6})$/i.exec(color)?.[1]
	if (hex === undefined) {
		// A named or functional colour cannot be weighed without resolving
		// it, and the editor only ever hands over hex
		return '#000000'
	}
	const red = Number.parseInt(hex.slice(0, 2), 16)
	const green = Number.parseInt(hex.slice(2, 4), 16)
	const blue = Number.parseInt(hex.slice(4, 6), 16)
	// Rec. 601 luma, the same gray the filters collapse a pixel to
	const luma = 0.299 * red + 0.587 * green + 0.114 * blue
	return luma > 140 ? '#000000' : '#ffffff'
}

/**
 * How wide the edge is drawn, scaled to the text so it stays the same
 * weight whether the caption is small or fills the frame.
 *
 * @param fontSize the size of the text it surrounds
 */
export function outlineWidth(fontSize: number): number {
	return Math.max(1, Math.round(fontSize / OUTLINE_RATIO))
}
