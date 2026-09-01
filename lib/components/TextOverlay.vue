<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from 'vue'
import { t } from '../utils/l10n.ts'

const props = defineProps<{
	/** Horizontal screen position inside the editor, in pixels */
	x: number
	/** Vertical screen position inside the editor, in pixels */
	y: number
	/** Screen font size in pixels */
	fontSize: number
	/** Text color */
	color: string
	/** Text to edit, empty when creating */
	initial: string
}>()

const emit = defineEmits<{
	confirm: [text: string]
	cancel: []
}>()

const inputLabel = t('Annotation text')

const value = ref(props.initial)
const input = useTemplateRef<HTMLTextAreaElement>('input')

onMounted(() => {
	input.value!.focus()
	input.value!.select()
})

/**
 * Confirm unless the enter stroke was meant as a line break.
 *
 * @param event the keyboard event
 */
function onEnter(event: KeyboardEvent) {
	if (!event.shiftKey) {
		event.preventDefault()
		emit('confirm', value.value)
	}
}
</script>

<template>
	<textarea
		ref="input"
		v-model="value"
		class="text-overlay"
		:aria-label="inputLabel"
		data-test="text-overlay"
		:style="{
			insetInlineStart: `${x}px`,
			insetBlockStart: `${y}px`,
			fontSize: `${fontSize}px`,
			color: color,
		}"
		rows="1"
		@keydown.enter="onEnter"
		@keydown.esc.stop="emit('cancel')"
		@blur="emit('confirm', value)" />
</template>

<style scoped>
.text-overlay {
	position: absolute;
	/* Kept in sync with the Konva text nodes for WYSIWYG editing */
	font-family: Helvetica, Arial, sans-serif;
	min-width: 4ch;
	background: transparent;
	border: 1px dashed var(--color-main-text, #666);
	line-height: 1;
	padding: 0;
	margin: 0;
	resize: none;
	overflow: hidden;
	z-index: 1;
}
</style>
