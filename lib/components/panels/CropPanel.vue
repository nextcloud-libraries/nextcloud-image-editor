<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import FlipHorizontal from 'vue-material-design-icons/FlipHorizontal.vue'
import FlipVertical from 'vue-material-design-icons/FlipVertical.vue'
import RotateLeft from 'vue-material-design-icons/RotateLeft.vue'
import RotateRight from 'vue-material-design-icons/RotateRight.vue'
import EditorSlider from '../base/EditorSlider.vue'
import { useEditorCommands } from '../../editor/commands.ts'
import { useEditorContext } from '../../editor/context.ts'
import { t } from '../../utils/l10n.ts'

defineProps<{
	/** Whether an image is loaded and the tools are usable */
	loaded: boolean
}>()

const context = useEditorContext()
const commands = useEditorCommands()

const labels = {
	rotateLeft: t('Rotate left'),
	rotateRight: t('Rotate right'),
	flipHorizontal: t('Flip horizontal'),
	flipVertical: t('Flip vertical'),
	applyCrop: t('Apply crop'),
	resetCrop: t('Reset crop'),
	rotation: t('Rotation'),
	scale: t('Scale'),
}

const aspectPresets: { id: number | 'original' | null, label: string }[] = [
	{ id: null, label: t('Free') },
	{ id: 'original', label: t('Original') },
	{ id: 1, label: '1:1' },
	{ id: 4 / 3, label: '4:3' },
	{ id: 16 / 9, label: '16:9' },
]

type CropControl = 'rotation' | 'scale'
const cropControls: { id: CropControl, label: string }[] = [
	{ id: 'rotation', label: labels.rotation },
	{ id: 'scale', label: labels.scale },
]
const activeCropControl = shallowRef<CropControl>('rotation')

const display = computed(() => activeCropControl.value === 'rotation'
	? `${context.state.value.fineRotation}°`
	: `×${context.state.value.zoom.toFixed(2)}`)

/**
 * Live-preview fine rotation or zoom while the slider is dragged.
 *
 * @param value the new transform value
 */
function onTransformInput(value: number) {
	context.preview(activeCropControl.value === 'rotation'
		? { ...context.state.value, fineRotation: value }
		: { ...context.state.value, zoom: value })
}

/**
 * Record the current preview as one undo step on release.
 */
function onSliderCommit() {
	context.commit(context.state.value)
}
</script>

<template>
	<div class="crop-panel">
		<div class="crop-panel__row">
			<NcButton
				v-for="preset in aspectPresets"
				:key="String(preset.id)"
				:data-test="`aspect-${preset.id === null ? 'free' : preset.id === 'original' ? 'original' : preset.label}`"
				:pressed="context.cropAspect.value === preset.id"
				:disabled="!loaded"
				variant="tertiary"
				@click="context.cropAspect.value = preset.id">
				{{ preset.label }}
			</NcButton>
		</div>
		<div class="crop-panel__row">
			<NcButton
				:aria-label="labels.rotateLeft"
				:title="labels.rotateLeft"
				:disabled="!loaded"
				variant="tertiary"
				@click="commands.rotateCCW()">
				<template #icon>
					<RotateLeft :size="20" />
				</template>
			</NcButton>
			<NcButton
				:aria-label="labels.rotateRight"
				:title="labels.rotateRight"
				:disabled="!loaded"
				variant="tertiary"
				@click="commands.rotateCW()">
				<template #icon>
					<RotateRight :size="20" />
				</template>
			</NcButton>
			<NcButton
				:aria-label="labels.flipHorizontal"
				:title="labels.flipHorizontal"
				:disabled="!loaded"
				variant="tertiary"
				@click="commands.flipHorizontal()">
				<template #icon>
					<FlipHorizontal :size="20" />
				</template>
			</NcButton>
			<NcButton
				:aria-label="labels.flipVertical"
				:title="labels.flipVertical"
				:disabled="!loaded"
				variant="tertiary"
				@click="commands.flipVertical()">
				<template #icon>
					<FlipVertical :size="20" />
				</template>
			</NcButton>

			<span class="crop-panel__divider" />

			<NcButton
				v-for="control in cropControls"
				:key="control.id"
				:data-test="`tab-${control.id}`"
				:pressed="activeCropControl === control.id"
				:disabled="!loaded"
				variant="tertiary"
				@click="activeCropControl = control.id">
				{{ control.label }}
			</NcButton>

			<span class="crop-panel__divider" />

			<NcButton
				data-test="reset-crop"
				variant="tertiary"
				:disabled="!loaded || context.state.value.crop === null"
				@click="commands.resetCrop()">
				{{ labels.resetCrop }}
			</NcButton>
			<NcButton
				data-test="apply-crop"
				variant="secondary"
				:disabled="!loaded"
				@click="commands.applyCrop()">
				{{ labels.applyCrop }}
			</NcButton>
		</div>
		<EditorSlider
			v-if="activeCropControl === 'rotation'"
			:value="context.state.value.fineRotation"
			:min="-45"
			:max="45"
			:step="1"
			:aria-label="labels.rotation"
			:display="display"
			data-test="fine-rotation"
			:disabled="!loaded"
			@input="onTransformInput"
			@commit="onSliderCommit" />
		<EditorSlider
			v-else
			:value="context.state.value.zoom"
			:min="1"
			:max="3"
			:step="0.05"
			:aria-label="labels.scale"
			:display="display"
			data-test="zoom"
			:disabled="!loaded"
			@input="onTransformInput"
			@commit="onSliderCommit" />
	</div>
</template>

<style scoped lang="scss">
.crop-panel {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: calc(var(--default-grid-baseline) * 2);
	width: 100%;

	&__row {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		gap: calc(var(--default-grid-baseline) * 2);
	}

	&__divider {
		width: 1px;
		height: 24px;
		background-color: rgba(255, 255, 255, 0.12);
	}
}
</style>
