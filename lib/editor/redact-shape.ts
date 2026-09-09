/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * The outlines a redaction can take.
 *
 * The things people redact are faces, heads and plates, none of which
 * are rectangles: boxing one means covering more of the picture than
 * needed, or leaving the corners of the thing meant to be hidden. Both
 * shapes are dragged the same way, the drag being the bounding box.
 */
export const REDACT_SHAPES = ['rectangle', 'ellipse'] as const

export type RedactShape = typeof REDACT_SHAPES[number]

/** The outline a redaction takes when nothing says otherwise */
export const DEFAULT_REDACT_SHAPE: RedactShape = 'rectangle'

/**
 * The outline to draw, falling back to the default for anything
 * unrecognised: a redaction made before the choice existed, one from a
 * newer version, or one whose state a host has edited by hand.
 *
 * @param shape the chosen outline, if any
 */
export function redactShape(shape: RedactShape | undefined): RedactShape {
	return REDACT_SHAPES.includes(shape as RedactShape) ? shape as RedactShape : DEFAULT_REDACT_SHAPE
}
