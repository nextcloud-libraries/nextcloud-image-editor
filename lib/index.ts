/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export type { UseHistory } from './composables/useHistory.ts'
export type {
	Adjustments,
	Annotation,
	ArrowAnnotation,
	BoxAnnotation,
	DrawAnnotation,
	EditorState,
	FilterPreset,
	Rect,
	RedactAnnotation,
	Rotation,
	Size,
	TextAnnotation,
} from './editor/state.ts'
export type { ExportOptions, ExportResult } from './types/export.ts'
export type { Orientation } from './utils/orientation.ts'

export { useHistory } from './composables/useHistory.ts'
// For consumers comparing against a pristine state, e.g. dirty checks
export { createInitialState, isPristine } from './editor/state.ts'

export { default as ImageEditor } from './components/ImageEditor.vue'

// Turning a JPEG by rewriting its orientation tag, for hosts that want to
// offer a rotation without opening the editor and re-encoding the picture
export { readJpegOrientation, setJpegOrientation } from './utils/jpeg.ts'
export { DEFAULT_ORIENTATION, isOrientation, rotateOrientation } from './utils/orientation.ts'
