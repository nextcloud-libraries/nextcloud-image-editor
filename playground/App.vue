<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { EditorState, ExportResult } from '../lib/index.ts'

import { ref, shallowRef } from 'vue'
import { ImageEditor } from '../lib/index.ts'

const BROKEN_SRC = 'data:image/png;base64,not-an-image'

/**
 * 200x100 test image: left half red rgb(200,0,0), right half blue
 * rgb(0,0,200). Colors below full intensity keep brightness math visible.
 */
function makeFixture(): Promise<Blob> {
	const canvas = document.createElement('canvas')
	canvas.width = 200
	canvas.height = 100
	const context = canvas.getContext('2d')!
	context.fillStyle = 'rgb(200, 0, 0)'
	context.fillRect(0, 0, 100, 100)
	context.fillStyle = 'rgb(0, 0, 200)'
	context.fillRect(100, 0, 100, 100)
	return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob!)))
}

// ?src=broken switches to an undecodable image for error-path testing
const src = shallowRef<Blob | string | null>(null)
if (new URLSearchParams(window.location.search).get('src') === 'broken') {
	src.value = BROKEN_SRC
} else {
	makeFixture().then((blob) => {
		src.value = blob
	})
}

const saved = ref('')
const stateJson = ref('')
const cancelled = ref(0)
const errors = ref<string[]>([])

/**
 * Expose the save payload plus pixel probes to the Playwright tests.
 *
 * @param result the exported image
 */
async function onSave(result: ExportResult) {
	const bitmap = await createImageBitmap(result.blob)
	const canvas = document.createElement('canvas')
	canvas.width = bitmap.width
	canvas.height = bitmap.height
	const context = canvas.getContext('2d')!
	context.drawImage(bitmap, 0, 0)

	const probe = (x: number, y: number) => Array.from(context.getImageData(x, y, 1, 1).data)
	saved.value = JSON.stringify({
		size: result.blob.size,
		width: result.width,
		height: result.height,
		mimeType: result.mimeType,
		topLeft: probe(0, 0),
		topRight: probe(canvas.width - 1, 0),
		bottomLeft: probe(0, canvas.height - 1),
		center: probe(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2)),
	})
}

/**
 * Mirror every state change for the Playwright tests.
 *
 * @param state the new edit state
 */
function onChange(state: EditorState) {
	stateJson.value = JSON.stringify(state)
}
</script>

<template>
	<main class="playground">
		<ImageEditor
			v-if="src !== null"
			:src="src"
			@save="onSave"
			@cancel="cancelled++"
			@error="errors.push($event.message)"
			@change="onChange" />
		<!-- Observable outcomes for the Playwright tests -->
		<output data-test="saved">{{ saved }}</output>
		<output data-test="state">{{ stateJson }}</output>
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

output {
	flex-shrink: 0;
	max-height: 40px;
	overflow: auto;
	font-size: 10px;
}
</style>
