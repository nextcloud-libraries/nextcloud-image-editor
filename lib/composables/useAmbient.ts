/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Ref, ShallowRef } from 'vue'
import type { SourceImage } from '../utils/image.ts'

import { ref, watch } from 'vue'
import { ambientBackdrop } from '../utils/theme.ts'

export interface Ambient {
	/** Tiny blurred copy of the image as a data URL, or empty */
	backdrop: Ref<string>
}

/**
 * Track the ambient wallpaper derived from the original image.
 * Deliberately fed by the untouched source: rotating or flipping the
 * edit must not make the wallpaper jump around.
 *
 * @param source the decoded source image
 */
export function useAmbient(source: ShallowRef<SourceImage | null>): Ambient {
	const backdrop = ref('')

	watch(source, (image) => {
		if (image !== null) {
			backdrop.value = ambientBackdrop(image)
		}
	})

	return { backdrop }
}
