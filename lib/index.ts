/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export type { UseHistory } from './composables/useHistory.ts'
export type {
	Adjustments,
	Annotation,
	EditorState,
	FilterPreset,
	Rect,
	Rotation,
} from './editor/state.ts'
export type { ExportOptions, ExportResult } from './types/index.ts'

export { useHistory } from './composables/useHistory.ts'

export { default as ImageEditor } from './components/ImageEditor.vue'
