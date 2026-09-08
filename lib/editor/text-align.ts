/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * How the lines of a text annotation sit against each other.
 *
 * The block is only ever as wide as its longest line, so alignment is
 * about where the shorter lines sit inside it, not about placing the
 * caption on the photo. A single line has nothing to align and looks
 * the same whichever of these is chosen.
 */
export const TEXT_ALIGNS = ['left', 'center', 'right'] as const

export type TextAlign = typeof TEXT_ALIGNS[number]

/** How lines sit when nothing says otherwise */
export const DEFAULT_ALIGN: TextAlign = 'left'

/**
 * The alignment to draw with, falling back to the default for anything
 * unrecognised: an annotation from a newer version, or one whose state
 * a host has edited by hand.
 *
 * @param align the chosen alignment, if any
 */
export function textAlign(align: TextAlign | undefined): TextAlign {
	return TEXT_ALIGNS.includes(align as TextAlign) ? align as TextAlign : DEFAULT_ALIGN
}
