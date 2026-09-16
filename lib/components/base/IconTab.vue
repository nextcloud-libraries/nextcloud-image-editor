<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
defineProps<{
	/** Name of the tab: shown under the icon, or only read out when iconOnly */
	label: string
	/** Whether this tab is the active one */
	active?: boolean
	/** Whether the tab is disabled */
	disabled?: boolean
	/** Square tab showing the icon slot alone, the label becomes its tooltip */
	iconOnly?: boolean
	/** Hook for the browser test suite */
	dataTest?: string
}>()

const emit = defineEmits<{
	/** The tab was clicked, with the event so a caller can reach the button */
	click: [event: MouseEvent]
}>()
</script>

<template>
	<button
		type="button"
		class="icon-tab"
		:class="{ 'icon-tab--active': active, 'icon-tab--icon-only': iconOnly }"
		:disabled="disabled"
		:data-test="dataTest"
		:aria-pressed="active"
		:aria-label="iconOnly ? label : undefined"
		:title="iconOnly ? label : undefined"
		@click="emit('click', $event)">
		<slot />
		<span v-if="!iconOnly">{{ label }}</span>
	</button>
</template>

<style scoped lang="scss">
// The one toggle of the editor chrome: a mode on the rail, an
// adjustment, a filter, a crop ratio, a drawing tool. Hover, active and
// focus match NcButton so the two can sit in one row.
.icon-tab {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 4px;
	min-width: max(64px, var(--default-clickable-area, 44px));
	min-height: var(--default-clickable-area, 44px);
	padding: calc(var(--default-grid-baseline) * 2) var(--default-grid-baseline);
	border: none;
	border-radius: var(--border-radius-large, 12px);
	background: transparent;
	color: var(--color-text-maxcontrast);
	// A button does not inherit the page font, it gets the browser's own
	font: inherit;
	letter-spacing: 0.01em;
	cursor: pointer;
	transition: background-color 0.12s ease, color 0.12s ease;

	&:hover:not(:disabled) {
		background-color: var(--color-background-hover);
		color: var(--color-main-text);
	}

	&:focus-visible {
		outline: 2px solid var(--color-main-text);
		box-shadow: 0 0 0 4px var(--color-main-background);
	}

	&--active {
		background: var(--editor-active);
		color: var(--color-main-text);
		box-shadow: inset 0 0 0 1px var(--color-border), 0 4px 16px rgba(0, 0, 0, 0.3);
	}

	&--icon-only {
		min-width: var(--default-clickable-area, 44px);
		padding: 0;
	}

	&:disabled {
		opacity: 0.5;
		cursor: default;
	}

	@container editor (max-width: 600px) {
		// Narrower, but never under the pointer target
		min-width: var(--default-clickable-area, 44px);
		padding: var(--default-grid-baseline) 2px;

		&--icon-only {
			padding: 0;
		}
	}
}
</style>
