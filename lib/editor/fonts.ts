/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * The families text can be drawn in.
 *
 * Every one of these is a stack of faces the operating system already
 * has. Nothing is downloaded, which is the point: a face that has not
 * finished loading when the export canvas renders is silently replaced
 * by a fallback, and the saved image then differs from what was on
 * screen with nothing to say so. Shipping our own faces would also put
 * a font file into a library that is currently smaller than one.
 *
 * The cost is that the same choice resolves to different faces on
 * different machines. That only shows while editing: what is saved is
 * whatever was drawn, baked into the pixels.
 */
export const FONT_STACKS = {
	sans: 'Helvetica, Arial, sans-serif',
	serif: 'Georgia, "Times New Roman", serif',
	mono: 'Menlo, Consolas, "Courier New", monospace',
} as const

export type FontId = keyof typeof FONT_STACKS

/** What text is drawn in when nothing says otherwise */
export const DEFAULT_FONT: FontId = 'sans'

/**
 * The stack to draw a font choice in, falling back to the default for
 * anything unrecognised: an annotation from a newer version, or one
 * whose state a host has edited by hand.
 *
 * @param font the chosen family, if any
 */
export function fontStack(font: FontId | undefined): string {
	return FONT_STACKS[font ?? DEFAULT_FONT] ?? FONT_STACKS[DEFAULT_FONT]
}
