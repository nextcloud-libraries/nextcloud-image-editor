/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/** What the probe found, so the question is asked of the browser once */
let converts: boolean | undefined

/**
 * Whether this browser converts a decoded image into sRGB before a
 * canvas sees it.
 *
 * It decides what the exported file may claim about its colours. A
 * wide-gamut photo decoded into sRGB leaves the canvas holding sRGB
 * numbers, and carrying the source's profile over them says those
 * numbers are Display P3, which paints the picture more saturated than
 * it was. A browser that hands the raw samples over instead leaves the
 * canvas in the source's space, where that same profile is the truth.
 *
 * Measured: Chromium converts, and tags what its encoder writes;
 * Firefox does neither. Support for a canvas in another colour space
 * stands in for the question, since a browser that can hold one is a
 * browser that knows what space an image arrived in. It is a proxy,
 * and the cheapest honest one available: the alternative is shipping a
 * wide-gamut image to decode and compare against.
 */
export function convertsToSrgb(): boolean {
	if (converts !== undefined) {
		return converts
	}
	converts = false
	try {
		const canvas = document.createElement('canvas')
		canvas.width = 1
		canvas.height = 1
		const context = canvas.getContext('2d', { colorSpace: 'display-p3' })
		converts = context?.getContextAttributes().colorSpace === 'display-p3'
	} catch {
		// A browser that will not answer is one that does not manage
	}
	return converts
}

/**
 * Forget what the probe found. Test seam only.
 */
export function resetColorSpaceProbe(): void {
	converts = undefined
}
