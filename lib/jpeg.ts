/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Turning a JPEG by its orientation tag, apart from the editor itself.
 *
 * The package's own entry pulls in the editor component, and with it Konva
 * and a stylesheet. A host that only wants to turn a picture, without ever
 * opening the editor, should not have to load a canvas library to do it,
 * and cannot load a stylesheet at all outside a browser. This entry carries
 * the byte work alone.
 */

export type { Orientation } from './utils/orientation.ts'

export { readJpegOrientation, setJpegOrientation } from './utils/jpeg.ts'
export { DEFAULT_ORIENTATION, isOrientation, rotateOrientation } from './utils/orientation.ts'
