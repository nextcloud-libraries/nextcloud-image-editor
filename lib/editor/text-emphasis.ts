/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * The four switches that change how the glyphs of a caption are cut,
 * independent of family, size and colour. Each is its own boolean so
 * any combination can be on at once, the way a word processor has it.
 */
export const TEXT_EMPHASES = ['bold', 'italic', 'underline', 'strikethrough'] as const

export type TextEmphasis = typeof TEXT_EMPHASES[number]

/** Whatever carries the emphasis switches, an annotation or the tool defaults */
export type Emphasised = Partial<Record<TextEmphasis, boolean>>

/**
 * The weight and slant as one string, in the form Konva's `fontStyle`
 * takes: it is dropped into the CSS `font` shorthand ahead of the size,
 * so both words are valid there.
 *
 * @param text the switches to read
 */
export function fontStyle(text: Emphasised): 'normal' | 'bold' | 'italic' | 'italic bold' {
	if (text.italic === true) {
		return text.bold === true ? 'italic bold' : 'italic'
	}
	return text.bold === true ? 'bold' : 'normal'
}

/**
 * The lines drawn through or under the glyphs, as Konva's
 * `textDecoration` and CSS `text-decoration-line` both spell them.
 *
 * @param text the switches to read
 */
export function textDecoration(text: Emphasised): '' | 'underline' | 'line-through' | 'underline line-through' {
	if (text.underline === true) {
		return text.strikethrough === true ? 'underline line-through' : 'underline'
	}
	return text.strikethrough === true ? 'line-through' : ''
}
