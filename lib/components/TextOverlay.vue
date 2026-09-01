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

/**
 * Grow the field with its content so the box never crops the text.
 */
function autosize() {
	const element = input.value
	if (element === null) {
		return
	}
	element.style.width = '0'
	element.style.height = '0'
	element.style.width = `${Math.max(element.scrollWidth + 4, props.fontSize * 2)}px`
	element.style.height = `${Math.max(element.scrollHeight, props.fontSize * 1.2)}px`
}

onMounted(() => {
	autosize()
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
		@input="autosize"
		@keydown.enter="onEnter"
		@keydown.esc.stop="emit('cancel')"
		@blur="emit('confirm', value)" />
</template>

<style scoped>
.text-overlay {
	position: absolute;
	/* Kept in sync with the Konva text nodes for WYSIWYG editing */
	font-family: Helvetica, Arial, sans-serif;
	line-height: 1;
	padding: 0;
	margin: 0;
	border: none;
	border-radius: 2px;
	background: transparent;
	outline: 1.5px solid var(--color-primary-element, #5b5cf0);
	outline-offset: 4px;
	box-shadow: 0 0 0 4px rgba(0, 0, 0, 0.15);
	caret-color: var(--color-primary-element, #5b5cf0);
	resize: none;
	overflow: hidden;
	white-space: pre;
	z-index: 1;
}
</style>
