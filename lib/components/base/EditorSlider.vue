<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { computed } from 'vue'
import { defaultOrigin, originPosition, snapToOrigin } from '../../editor/slider.ts'

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
	/**
	 * Value the slider is neutral at, marked on the track and snapped to.
	 * Defaults to zero for a range crossing it, to none for one that
	 * does not: a range starting at its neutral value needs no mark, the
	 * thumb rests there.
	 */
	origin?: number
}>()

const emit = defineEmits<{
	/** Continuous value updates while dragging */
	input: [value: number]
	/** The drag ended, record the result */
	commit: []
}>()

const origin = computed(() => props.origin ?? defaultOrigin(props.min, props.max))

// Thumb centres travel between half a thumb from each end
const originOffset = computed(() => origin.value === null
	? null
	: `calc(var(--slider-thumb-size) / 2 + (100% - var(--slider-thumb-size)) * ${originPosition(origin.value, props.min, props.max)})`)

/**
 * Forward the native input event as a numeric update, snapped onto the
 * origin when it lands next to it.
 *
 * @param event the range input event
 */
function onInput(event: Event) {
	const input = event.target as HTMLInputElement
	const value = snapToOrigin(Number(input.value), origin.value, props.min, props.max)
	// The bound value is unchanged when a snap swallows the drag, and an
	// input Vue does not re-render keeps the thumb where the pointer left it
	input.value = String(value)
	emit('input', value)
}
</script>

<template>
	<div class="editor-slider">
		<div class="editor-slider__track">
			<!-- Decoration: the value the slider is neutral at, which the
			     thumb position and the readout already say out loud -->
			<span
				v-if="originOffset !== null"
				class="editor-slider__origin"
				aria-hidden="true"
				:style="{ insetInlineStart: originOffset }" />
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
		</div>
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
	--slider-thumb-size: 14px;
	gap: calc(var(--default-grid-baseline) * 3);
	width: 100%;

	&__track {
		position: relative;
		display: flex;
		flex: 1;
	}

	// Sits under the thumb, which covers it while the slider is neutral
	&__origin {
		position: absolute;
		inset-block: 4px;
		width: 2px;
		margin-inline-start: -1px;
		border-radius: 1px;
		background: var(--color-border-maxcontrast);
	}

	input[type='range'] {
		appearance: none;
		position: relative;
		flex: 1;
		height: 20px;
		margin: 0;
		background: linear-gradient(var(--color-border-dark), var(--color-border-dark)) center / 100% 2px no-repeat;
		cursor: ew-resize;

		&::-webkit-slider-thumb {
			appearance: none;
			width: var(--slider-thumb-size);
			height: var(--slider-thumb-size);
			border-radius: 50%;
			background: var(--color-main-text);
			box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
		}

		&::-moz-range-thumb {
			width: var(--slider-thumb-size);
			height: var(--slider-thumb-size);
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
