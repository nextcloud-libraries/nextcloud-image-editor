<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { FilterPreset } from '../editor/state.ts'

import { shallowRef } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import { useEditorContext } from '../editor/context.ts'
import { t } from '../utils/l10n.ts'

defineProps<{
	/** Whether an image is loaded and the tools are usable */
	loaded: boolean
}>()

const context = useEditorContext()

type AdjustmentKey = 'brightness' | 'contrast' | 'saturation'

const adjustments: { id: AdjustmentKey, label: string }[] = [
	{ id: 'brightness', label: t('Brightness') },
	{ id: 'contrast', label: t('Contrast') },
	{ id: 'saturation', label: t('Saturation') },
]

const presets: { id: FilterPreset, label: string }[] = [
	{ id: 'none', label: t('No filter') },
	{ id: 'grayscale', label: t('Grayscale') },
	{ id: 'sepia', label: t('Sepia') },
]

// One slider at a time, switched through the tabs below it
const activeAdjustment = shallowRef<AdjustmentKey>('brightness')

/**
 * Live-preview the active adjustment while its slider is dragged.
 *
 * @param event the range input event
 */
function onAdjustInput(event: Event) {
	const value = Number((event.target as HTMLInputElement).value)
	const state = context.state.value
	context.preview({
		...state,
		adjustments: { ...state.adjustments, [activeAdjustment.value]: value },
	})
}

/**
 * Record the adjustment as one undo step when the slider is released.
 */
function onAdjustChange() {
	context.commit(context.state.value)
}

/**
 * Apply a filter preset.
 *
 * @param preset the preset to apply
 */
function setPreset(preset: FilterPreset) {
	context.commit({ ...context.state.value, preset })
}
</script>

<template>
	<div class="editor-bottombar">
		<Transition name="editor-fade" mode="out-in">
			<div
				v-if="context.activeMode.value === 'finetune'"
				key="finetune"
				class="editor-bottombar__stack">
				<label class="editor-bottombar__slider">
					<span class="hidden-visually">{{ adjustments.find((entry) => entry.id === activeAdjustment)!.label }}</span>
					<input
						:value="context.state.value.adjustments[activeAdjustment]"
						:data-test="`adjust-${activeAdjustment}`"
						:disabled="!loaded"
						type="range"
						min="-100"
						max="100"
						step="1"
						@input="onAdjustInput"
						@change="onAdjustChange">
				</label>
				<div class="editor-bottombar__tabs">
					<NcButton
						v-for="adjustment in adjustments"
						:key="adjustment.id"
						:data-test="`tab-${adjustment.id}`"
						:pressed="activeAdjustment === adjustment.id"
						:disabled="!loaded"
						variant="tertiary"
						@click="activeAdjustment = adjustment.id">
						{{ adjustment.label }}
					</NcButton>
				</div>
			</div>

			<div
				v-else-if="context.activeMode.value === 'filter'"
				key="filter"
				class="editor-bottombar__tabs">
				<NcButton
					v-for="preset in presets"
					:key="preset.id"
					:data-test="`preset-${preset.id}`"
					:pressed="context.state.value.preset === preset.id"
					:disabled="!loaded"
					variant="tertiary"
					@click="setPreset(preset.id)">
					{{ preset.label }}
				</NcButton>
			</div>

			<div v-else key="none" class="editor-bottombar__tabs" />
		</Transition>
	</div>
</template>

<style scoped lang="scss">
.editor-bottombar {
	// Constant height so the canvas never jumps when switching modes
	min-height: 72px;
	display: flex;
	align-items: center;
	justify-content: center;

	&__stack {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--default-grid-baseline);
	}

	&__slider input {
		width: 280px;
		accent-color: var(--color-primary-element);
	}

	&__tabs {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--default-grid-baseline);
	}
}

.hidden-visually {
	position: absolute;
	width: 1px;
	height: 1px;
	overflow: hidden;
	clip-path: inset(50%);
}

.editor-fade-enter-active,
.editor-fade-leave-active {
	transition: opacity 0.15s ease, transform 0.15s ease;
}

.editor-fade-enter-from,
.editor-fade-leave-to {
	opacity: 0;
	transform: translateY(2px);
}

@media (prefers-reduced-motion: reduce) {
	.editor-fade-enter-active,
	.editor-fade-leave-active {
		transition: none;
	}
}
</style>
