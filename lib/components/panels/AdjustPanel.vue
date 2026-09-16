<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { EditorState } from '../../editor/state.ts'

import { computed, shallowRef } from 'vue'
import BoxShadow from 'vue-material-design-icons/BoxShadow.vue'
import CameraIris from 'vue-material-design-icons/CameraIris.vue'
import CircleOpacity from 'vue-material-design-icons/CircleOpacity.vue'
import ContrastCircle from 'vue-material-design-icons/ContrastCircle.vue'
import ImageFilterCenterFocus from 'vue-material-design-icons/ImageFilterCenterFocus.vue'
import InvertColors from 'vue-material-design-icons/InvertColors.vue'
import Spotlight from 'vue-material-design-icons/Spotlight.vue'
import Thermometer from 'vue-material-design-icons/Thermometer.vue'
import WhiteBalanceIridescent from 'vue-material-design-icons/WhiteBalanceIridescent.vue'
import WhiteBalanceSunny from 'vue-material-design-icons/WhiteBalanceSunny.vue'
import EditorSlider from '../base/EditorSlider.vue'
import IconTab from '../base/IconTab.vue'
import { useEditorContext } from '../../editor/context.ts'
import { t } from '../../utils/l10n.ts'

defineProps<{
	/** Whether an image is loaded and the tools are usable */
	loaded: boolean
}>()

const context = useEditorContext()

type AdjustmentKey = keyof EditorState['adjustments']

// Photographic order: light first, then contrast, then colour, then the
// two ends of the range on their own, with sharpening and the vignette
// last because they work on whatever the rest produced
const adjustments: { id: AdjustmentKey, label: string, icon: unknown }[] = [
	{ id: 'exposure', label: t('Exposure'), icon: CameraIris },
	{ id: 'brightness', label: t('Brightness'), icon: WhiteBalanceSunny },
	{ id: 'contrast', label: t('Contrast'), icon: ContrastCircle },
	{ id: 'saturation', label: t('Saturation'), icon: InvertColors },
	{ id: 'temperature', label: t('Temperature'), icon: Thermometer },
	{ id: 'tint', label: t('Tint'), icon: WhiteBalanceIridescent },
	{ id: 'sharpen', label: t('Sharpen'), icon: ImageFilterCenterFocus },
	{ id: 'highlights', label: t('Highlights'), icon: Spotlight },
	{ id: 'shadows', label: t('Shadows'), icon: BoxShadow },
	{ id: 'vignette', label: t('Vignette'), icon: CircleOpacity },
]
const activeAdjustment = shallowRef<AdjustmentKey>('exposure')

const display = computed(() => {
	const value = context.state.value.adjustments[activeAdjustment.value]
	return value > 0 ? `+${value}` : `${value}`
})

/**
 * Make an adjustment the active one and bring its tab fully into view,
 * as one at the edge of the scrolled row is only half visible.
 *
 * @param id the adjustment to select
 * @param event the click, whose target is the tab
 */
function select(id: AdjustmentKey, event: MouseEvent) {
	activeAdjustment.value = id
	;(event.currentTarget as HTMLElement | null)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

/**
 * Live-preview the active adjustment while the slider is dragged.
 *
 * @param value the new adjustment value
 */
function onAdjustInput(value: number) {
	const state = context.state.value
	context.preview({
		...state,
		adjustments: { ...state.adjustments, [activeAdjustment.value]: value },
	})
}

/**
 * Record the current preview as one undo step on release.
 */
function onSliderCommit() {
	context.commit(context.state.value, adjustments.find((entry) => entry.id === activeAdjustment.value)!.label)
}
</script>

<template>
	<div class="adjust-panel">
		<div class="adjust-panel__tabs">
			<IconTab
				v-for="adjustment in adjustments"
				:key="adjustment.id"
				:label="adjustment.label"
				:active="activeAdjustment === adjustment.id"
				:disabled="!loaded"
				:data-test="`tab-${adjustment.id}`"
				@click="select(adjustment.id, $event)">
				<component :is="adjustment.icon" :size="20" />
			</IconTab>
		</div>
		<EditorSlider
			:value="context.state.value.adjustments[activeAdjustment]"
			:min="-100"
			:max="100"
			:step="1"
			:label="adjustments.find((entry) => entry.id === activeAdjustment)!.label"
			:display="display"
			:data-test="`adjust-${activeAdjustment}`"
			:disabled="!loaded"
			@input="onAdjustInput"
			@commit="onSliderCommit" />
	</div>
</template>

<style scoped lang="scss">
.adjust-panel {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: calc(var(--default-grid-baseline) * 2);
	width: 100%;

	&__tabs {
		display: flex;
		align-items: center;
		// Centred while they fit, scrolled from the start once they do not:
		// plain `center` would push the first tabs out of reach
		justify-content: safe center;
		gap: calc(var(--default-grid-baseline) * 2);
		// One row whatever the width, the rest is a swipe away
		max-width: 100%;
		overflow-x: auto;
		// Room for the focus ring, which the scroll box would clip otherwise
		padding: 2px;
		scrollbar-width: thin;
		scrollbar-color: rgba(255, 255, 255, 0.25) transparent;

		> * {
			flex-shrink: 0;
		}

		&::-webkit-scrollbar {
			height: 6px;
		}

		&::-webkit-scrollbar-thumb {
			background: rgba(255, 255, 255, 0.22);
			border-radius: 3px;
		}

		&::-webkit-scrollbar-track {
			background: transparent;
		}
	}
}
</style>
