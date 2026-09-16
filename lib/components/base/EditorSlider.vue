<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
const props = defineProps<{
	/** Current value */
	value: number
	/** Lower bound */
	min: number
	/** Upper bound */
	max: number
	/** Slider step */
	step: number
	/** Accessible name of the slider */
	label: string
	/** Text shown next to the slider, defaults to the raw value */
	display?: string
	/** Hook for the browser test suite */
	dataTest?: string
	/** Whether the slider is disabled */
	disabled?: boolean
}>()

const emit = defineEmits<{
	/** Continuous value updates while dragging */
	input: [value: number]
	/** The drag ended, record the result */
	commit: []
}>()

/**
 * Forward the native input event as a numeric update.
 *
 * @param event the range input event
 */
function onInput(event: Event) {
	emit('input', Number((event.target as HTMLInputElement).value))
}
</script>

<template>
	<div class="editor-slider">
		<input
			:value="props.value"
			:data-test="dataTest"
			:disabled="disabled"
			:aria-label="label"
			type="range"
			:min="min"
			:max="max"
			:step="step"
			@input="onInput"
			@change="emit('commit')">
		<output>
			<!-- Defaults to the raw value; size controls show what the
				value looks like on the canvas instead -->
			<slot name="preview">{{ display ?? props.value }}</slot>
		</output>
	</div>
</template>

<style scoped lang="scss">
// Thin line slider with a round thumb and the value to its right
.editor-slider {
	display: flex;
	align-items: center;
	gap: calc(var(--default-grid-baseline) * 3);
	width: 100%;

	input[type='range'] {
		appearance: none;
		flex: 1;
		height: 20px;
		margin: 0;
		background: linear-gradient(var(--color-border-dark), var(--color-border-dark)) center / 100% 2px no-repeat;
		cursor: ew-resize;

		&::-webkit-slider-thumb {
			appearance: none;
			width: 14px;
			height: 14px;
			border-radius: 50%;
			background: var(--color-main-text);
			box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
		}

		&::-moz-range-thumb {
			width: 14px;
			height: 14px;
			border: none;
			border-radius: 50%;
			background: var(--color-main-text);
			box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
		}

		&:focus-visible {
			outline: 2px solid var(--color-main-text);
			box-shadow: 0 0 0 4px var(--color-main-background);
		}
	}

	output {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		min-width: 44px;
		min-height: 44px;
		text-align: end;
		font-variant-numeric: tabular-nums;
	}
}
</style>
