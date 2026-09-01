/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Ref, ShallowRef } from 'vue'

import { ref, watch } from 'vue'
import { ambientBackdrop, ambientColor } from '../utils/theme.ts'

export interface Ambient {
	/** Dominant image color as an "r, g, b" triplet for CSS rgba() */
	ambient: Ref<string>
	/** Tiny blurred copy of the image as a data URL, or empty */
	backdrop: Ref<string>
}

/**
 * Track the ambient chrome tint derived from the original image.
 * Deliberately fed by the untouched source: rotating or flipping the
 * edit must not make the wallpaper jump around.
 *
 * @param source the decoded source image
 */
export function useAmbient(source: ShallowRef<HTMLImageElement | null>): Ambient {
	const ambient = ref('88, 86, 112')
	const backdrop = ref('')

	watch(source, (image) => {
		if (image !== null) {
			ambient.value = ambientColor(image)
			backdrop.value = ambientBackdrop(image)
		}
	})

	return { ambient, backdrop }
}
