<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
defineProps<{
	/** Preview image data URL */
	url: string
	/** Visible label under the preview */
	label: string
	/** Whether this preset is the active one */
	active?: boolean
	/** Whether the chip is disabled */
	disabled?: boolean
	/** Hook for the browser test suite */
	dataTest?: string
}>()

const emit = defineEmits<{
	click: []
}>()
</script>

<template>
	<button
		type="button"
		class="preset-chip"
		:class="{ 'preset-chip--active': active }"
		:disabled="disabled"
		:data-test="dataTest"
		:aria-pressed="active"
		:title="label"
		@click="emit('click')">
		<img :src="url" :alt="label">
		<span>{{ label }}</span>
	</button>
</template>

<style scoped lang="scss">
.preset-chip {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 2px;
	padding: 0;
	border: none;
	background: transparent;
	color: var(--color-main-text);
	font-size: 10px;
	cursor: pointer;

	img {
		width: 64px;
		aspect-ratio: 4 / 3;
		object-fit: cover;
		border-radius: 10px;
		box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1);
		transition: box-shadow 0.12s ease, transform 0.12s ease;
	}

	&:hover img {
		transform: scale(1.03);
	}

	&--active img,
	&:focus-visible img {
		box-shadow: 0 0 0 2px var(--color-primary-element);
	}

	&:focus-visible {
		outline: none;
	}

	&:disabled {
		opacity: 0.5;
		cursor: default;
	}
}
</style>
