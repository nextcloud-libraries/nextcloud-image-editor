<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { ExportResult } from '../lib/index.ts'

import { ref } from 'vue'
import { ImageEditor } from '../lib/index.ts'

// 1x1 red pixel
const VALID_SRC = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const BROKEN_SRC = 'data:image/png;base64,not-an-image'

// ?src=broken switches to an undecodable image for error-path testing
const src = new URLSearchParams(window.location.search).get('src') === 'broken'
	? BROKEN_SRC
	: VALID_SRC

const saved = ref('')
const cancelled = ref(0)
const errors = ref<string[]>([])

/**
 * Expose the save payload to the Playwright tests.
 *
 * @param result the exported image
 */
function onSave(result: ExportResult) {
	saved.value = JSON.stringify({
		size: result.blob.size,
		width: result.width,
		height: result.height,
		mimeType: result.mimeType,
	})
}
</script>

<template>
	<main class="playground">
		<ImageEditor
			:src="src"
			@save="onSave"
			@cancel="cancelled++"
			@error="errors.push($event.message)" />
		<!-- Observable outcomes for the Playwright tests -->
		<output data-test="saved">{{ saved }}</output>
		<output data-test="cancelled">{{ cancelled }}</output>
		<output data-test="errors">{{ errors.join(', ') }}</output>
	</main>
</template>

<style scoped>
.playground {
	display: flex;
	flex-direction: column;
	height: 100vh;
}
</style>
