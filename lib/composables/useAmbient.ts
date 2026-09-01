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
 * Track the ambient chrome tint derived from the edited image.
 *
 * @param oriented the orientation-baked source canvas
 */
export function useAmbient(oriented: ShallowRef<HTMLCanvasElement | null>): Ambient {
	const ambient = ref('88, 86, 112')
	const backdrop = ref('')

	watch(oriented, (canvas) => {
		if (canvas !== null) {
			ambient.value = ambientColor(canvas)
			backdrop.value = ambientBackdrop(canvas)
		}
	})

	return { ambient, backdrop }
}
