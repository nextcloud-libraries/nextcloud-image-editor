<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
defineProps<{
	/** Visible label under the icon */
	label: string
	/** Whether this tab is the active one */
	active?: boolean
	/** Whether the tab is disabled */
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
		class="icon-tab"
		:class="{ 'icon-tab--active': active }"
		:disabled="disabled"
		:data-test="dataTest"
		:aria-pressed="active"
		@click="emit('click')">
		<slot />
		<span>{{ label }}</span>
	</button>
</template>

<style scoped lang="scss">
// Icon-above-label tab, softly tinted by the image's ambient color
// while active
.icon-tab {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 4px;
	min-width: 64px;
	padding: calc(var(--default-grid-baseline) * 2) var(--default-grid-baseline);
	border: none;
	border-radius: var(--border-radius-large, 12px);
	background: transparent;
	color: rgba(242, 242, 247, 0.75);
	font-size: 11px;
	letter-spacing: 0.01em;
	cursor: pointer;
	transition: background-color 0.12s ease, color 0.12s ease, transform 0.12s ease;

	&:active:not(:disabled) {
		transform: scale(0.96);
	}

	&:hover:not(:disabled) {
		background-color: rgba(255, 255, 255, 0.07);
		color: var(--color-main-text);
	}

	&:focus-visible {
		outline: 2px solid var(--color-primary-element);
		outline-offset: 2px;
	}

	&--active {
		background: rgba(var(--editor-ambient, 88, 86, 112), 0.3);
		color: var(--color-main-text);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12), 0 4px 16px rgba(0, 0, 0, 0.3);
		backdrop-filter: blur(12px);
	}

	&:disabled {
		opacity: 0.5;
		cursor: default;
	}
}
</style>
