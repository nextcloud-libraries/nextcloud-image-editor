<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { EditorState, ExportResult } from '../lib/index.ts'

import { ref, shallowRef } from 'vue'
import { ImageEditor } from '../lib/index.ts'
import demoPhoto from './demo.jpg'

const BROKEN_SRC = 'data:image/png;base64,not-an-image'

// Clown fish in a sea anemone by Bro Takes Photos (Unsplash License,
// free to use), bundled with the playground so the demo needs no
// network and still exercises a real multi-megapixel image
// https://unsplash.com/photos/a-clown-fish-peeking-out-of-a-pink-sea-anemone-jUvUDx_cb4s
const DEMO_SRC = demoPhoto

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

/**
 * 2000x1500 test image in four quadrants: red, blue, green and yellow.
 * Large enough that the fitted view is downscaled, so zooming actually
 * overflows the container and the view can be panned.
 */
function makeLargeFixture(): Promise<Blob> {
	const canvas = document.createElement('canvas')
	canvas.width = 2000
	canvas.height = 1500
	const context = canvas.getContext('2d')!
	const quadrants = [
		['rgb(200, 0, 0)', 0, 0],
		['rgb(0, 0, 200)', 1000, 0],
		['rgb(0, 200, 0)', 0, 750],
		['rgb(200, 200, 0)', 1000, 750],
	] as const
	for (const [fill, x, y] of quadrants) {
		context.fillStyle = fill
		context.fillRect(x, y, 1000, 750)
	}
	return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob!)))
}

// ?src=test loads the deterministic fixture the Playwright suite probes,
// ?src=broken an undecodable image; default is a real demo photo
const src = shallowRef<Blob | string | null>(null)
const requested = new URLSearchParams(window.location.search).get('src')
if (requested === 'broken') {
	src.value = BROKEN_SRC
} else if (requested === 'test') {
	makeFixture().then((blob) => {
		src.value = blob
	})
} else if (requested === 'large') {
	makeLargeFixture().then((blob) => {
		src.value = blob
	})
} else {
	src.value = DEMO_SRC
}

const saved = ref('')
const stateJson = ref('')
const changes = ref(0)
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
 * Keep the demo alive without network access: fall back to the
 * generated fixture when the remote photo cannot load.
 *
 * @param error the load failure
 */
async function onError(error: Error) {
	errors.value.push(error.message)
	if (src.value === DEMO_SRC) {
		src.value = await makeFixture()
	}
}

/**
 * Mirror every reported state change for the Playwright tests, and
 * count them so a test can tell a drag from its release.
 *
 * @param state the new edit state
 */
function onChange(state: EditorState) {
	stateJson.value = JSON.stringify(state)
	changes.value++
}
</script>

<template>
	<main class="playground">
		<ImageEditor
			v-if="src !== null"
			:src="src"
			@save="onSave"
			@cancel="cancelled++"
			@error="onError"
			@change="onChange" />
		<!-- Observable outcomes for the Playwright tests, hidden on the
			default demo page -->
		<template v-if="requested !== null">
			<output data-test="saved">{{ saved }}</output>
			<output data-test="state">{{ stateJson }}</output>
			<output data-test="changes">{{ changes }}</output>
			<output data-test="cancelled">{{ cancelled }}</output>
			<output data-test="errors">{{ errors.join(', ') }}</output>
		</template>
	</main>
</template>

<style scoped>
.playground {
	height: 100vh;
}

/* Test-observability overlay: must never affect the editor layout,
   moving it mid-test shifts every canvas coordinate */
output {
	position: fixed;
	inset-inline: 0;
	max-height: 24px;
	overflow: hidden;
	font-size: 9px;
	opacity: 0.4;
	pointer-events: none;
	z-index: 10;
}

output[data-test='saved'] { inset-block-end: 72px; }
output[data-test='state'] { inset-block-end: 48px; }
output[data-test='cancelled'] { inset-block-end: 24px; }
output[data-test='errors'] { inset-block-end: 0; }
</style>
