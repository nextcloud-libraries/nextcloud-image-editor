<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<!--
	Editing a local file, with nothing stored anywhere: pick an image,
	edit it, and get the edited Blob back to preview or download. Open
	the playground with ?demo=local-file to see it.
-->
<script setup lang="ts">
import type { ExportResult } from '../lib/index.ts'

import { onBeforeUnmount, ref, shallowRef } from 'vue'
import { ImageEditor } from '../lib/index.ts'

/** The picked image, handed to the editor as it is */
const file = shallowRef<File | null>(null)
/** The edited image, as an object URL for the preview and the download */
const result = shallowRef<{ url: string, name: string, type: string, size: number } | null>(null)
const error = ref('')

/**
 * Let go of the object URL of the last result. A URL from
 * createObjectURL keeps its Blob alive until it is revoked.
 */
function clearResult() {
	if (result.value !== null) {
		URL.revokeObjectURL(result.value.url)
		result.value = null
	}
}

/**
 * Open the picked file in the editor.
 *
 * @param event the change event of the file input
 */
function onPick(event: Event) {
	const picked = (event.target as HTMLInputElement).files?.[0]
	clearResult()
	error.value = ''
	file.value = picked ?? null
}

/**
 * Keep the edited image and close the editor.
 *
 * @param saved the edited image
 * @param saved.blob its bytes
 * @param saved.mimeType its format
 */
function onSave({ blob, mimeType }: ExportResult) {
	clearResult()
	const extension = mimeType.split('/')[1]!.replace('jpeg', 'jpg')
	const base = file.value!.name.replace(/\.[^.]*$/, '')
	result.value = {
		url: URL.createObjectURL(blob),
		name: `${base}-edited.${extension}`,
		type: mimeType,
		size: blob.size,
	}
	file.value = null
}

/**
 * Close the editor without keeping anything.
 */
function onCancel() {
	file.value = null
}

/**
 * Say why the image could not be loaded or saved. The editor stays
 * open, so the user can try again or cancel.
 *
 * @param failure what went wrong
 */
function onError(failure: Error) {
	error.value = failure.message
}

onBeforeUnmount(clearResult)
</script>

<template>
	<main class="local-file">
		<ImageEditor
			v-if="file !== null"
			:src="file"
			:label="file.name"
			@save="onSave"
			@cancel="onCancel"
			@error="onError" />
		<div v-else class="local-file__picker">
			<label>
				Pick an image to edit
				<input type="file" accept="image/*" @change="onPick">
			</label>
			<figure v-if="result !== null" data-test="local-result">
				<img :src="result.url" alt="The edited image">
				<figcaption>
					{{ result.type }}, {{ result.size }} bytes,
					<a :href="result.url" :download="result.name">download {{ result.name }}</a>
				</figcaption>
			</figure>
		</div>
		<p v-if="error !== ''" role="alert" class="local-file__error">
			{{ error }}
		</p>
	</main>
</template>

<style scoped>
.local-file {
	height: 100vh;
}

.local-file__picker {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 16px;
	padding: 32px;
}

.local-file__picker img {
	max-width: 100%;
	max-height: 70vh;
}

.local-file__error {
	position: fixed;
	inset-block-end: 0;
	inset-inline: 0;
	margin: 0;
	padding: 8px;
	background: #b00020;
	color: #fff;
	z-index: 10;
}
</style>
