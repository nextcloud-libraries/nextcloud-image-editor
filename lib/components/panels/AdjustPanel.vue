<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import ContrastCircle from 'vue-material-design-icons/ContrastCircle.vue'
import InvertColors from 'vue-material-design-icons/InvertColors.vue'
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

type AdjustmentKey = 'brightness' | 'contrast' | 'saturation'
const adjustments: { id: AdjustmentKey, label: string, icon: unknown }[] = [
	{ id: 'brightness', label: t('Brightness'), icon: WhiteBalanceSunny },
	{ id: 'contrast', label: t('Contrast'), icon: ContrastCircle },
	{ id: 'saturation', label: t('Saturation'), icon: InvertColors },
]
const activeAdjustment = shallowRef<AdjustmentKey>('brightness')

const display = computed(() => {
	const value = context.state.value.adjustments[activeAdjustment.value]
	return value > 0 ? `+${value}` : `${value}`
})

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
	context.commit(context.state.value)
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
				@click="activeAdjustment = adjustment.id">
				<component :is="adjustment.icon" :size="20" />
			</IconTab>
		</div>
		<EditorSlider
			:value="context.state.value.adjustments[activeAdjustment]"
			:min="-100"
			:max="100"
			:step="1"
			:aria-label="adjustments.find((entry) => entry.id === activeAdjustment)!.label"
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
		justify-content: center;
		gap: calc(var(--default-grid-baseline) * 2);
	}
}
</style>
