/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Ref } from 'vue'
import type { EditorContext } from '../editor/context.ts'

import { ref, watch } from 'vue'
import { t } from '../utils/l10n.ts'

/**
 * Screen-reader announcements for state changes that have no visible
 * text of their own: mode switches, history moves and preset changes.
 * The returned message feeds an aria-live region.
 *
 * @param context the editor context
 */
export function useAnnouncements(context: EditorContext): Ref<string> {
	const message = ref('')

	const modeLabels: Record<string, string> = {
		select: t('Select'),
		crop: t('Crop'),
		finetune: t('Adjust'),
		filter: t('Filter'),
		annotate: t('Annotate'),
		sticker: t('Sticker'),
		redact: t('Redact'),
	}

	watch(context.activeMode, (mode) => {
		message.value = t('{mode} mode', { mode: modeLabels[mode] ?? mode })
	})

	let annotationCount = 0
	watch(context.state, (state) => {
		if (state.annotations.length > annotationCount) {
			message.value = t('Annotation added')
		} else if (state.annotations.length < annotationCount) {
			message.value = t('Annotation removed')
		}
		annotationCount = state.annotations.length
	})

	watch(() => context.state.value.preset, (preset) => {
		message.value = preset === 'none'
			? t('Filter removed')
			: t('Filter applied')
	})

	return message
}
