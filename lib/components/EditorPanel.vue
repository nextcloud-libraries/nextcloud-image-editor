<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Tool } from '../editor/context.ts'
import type { FilterPreset } from '../editor/state.ts'

import { computed, shallowRef } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import ArrowTopRight from 'vue-material-design-icons/ArrowTopRight.vue'
import ContrastCircle from 'vue-material-design-icons/ContrastCircle.vue'
import CursorDefaultOutline from 'vue-material-design-icons/CursorDefaultOutline.vue'
import EllipseOutline from 'vue-material-design-icons/EllipseOutline.vue'
import FlipHorizontal from 'vue-material-design-icons/FlipHorizontal.vue'
import FlipVertical from 'vue-material-design-icons/FlipVertical.vue'
import FormatText from 'vue-material-design-icons/FormatText.vue'
import InvertColors from 'vue-material-design-icons/InvertColors.vue'
import Pencil from 'vue-material-design-icons/Pencil.vue'
import RectangleOutline from 'vue-material-design-icons/RectangleOutline.vue'
import RotateLeft from 'vue-material-design-icons/RotateLeft.vue'
import RotateRight from 'vue-material-design-icons/RotateRight.vue'
import WhiteBalanceSunny from 'vue-material-design-icons/WhiteBalanceSunny.vue'
import EditorSlider from './base/EditorSlider.vue'
import GlassSurface from './base/GlassSurface.vue'
import IconTab from './base/IconTab.vue'
import PresetChip from './base/PresetChip.vue'
import { useEditorContext } from '../editor/context.ts'
import { presetThumbnail } from '../editor/render.ts'
import { t } from '../utils/l10n.ts'

const props = defineProps<{
	/** Whether an image is loaded and the tools are usable */
	loaded: boolean
	/** Orientation-baked source canvas, for the filter previews */
	oriented?: HTMLCanvasElement | null
}>()

const emit = defineEmits<{
	rotateCcw: []
	rotateCw: []
	flipHorizontal: []
	flipVertical: []
	applyCrop: []
	resetCrop: []
}>()

const context = useEditorContext()

const STICKERS = ['😀', '😍', '🎉', '👍', '❤️', '⭐', '🔥', '💡', '✅', '❌', '❓', '⚠️']

const aspectPresets: { id: number | 'original' | null, label: string }[] = [
	{ id: null, label: t('Free') },
	{ id: 'original', label: t('Original') },
	{ id: 1, label: '1:1' },
	{ id: 4 / 3, label: '4:3' },
	{ id: 16 / 9, label: '16:9' },
]

const labels = {
	rotateLeft: t('Rotate left'),
	rotateRight: t('Rotate right'),
	flipHorizontal: t('Flip horizontal'),
	flipVertical: t('Flip vertical'),
	applyCrop: t('Apply crop'),
	resetCrop: t('Reset crop'),
	rotation: t('Rotation'),
	scale: t('Scale'),
	color: t('Color'),
	strokeWidth: t('Stroke width'),
	fontSize: t('Font size'),
	pixelate: t('Pixelate'),
	blur: t('Blur'),
}

const subTools: { id: Tool, label: string, icon: unknown }[] = [
	{ id: 'select', label: t('Select'), icon: CursorDefaultOutline },
	{ id: 'draw', label: t('Draw'), icon: Pencil },
	{ id: 'rectangle', label: t('Rectangle'), icon: RectangleOutline },
	{ id: 'ellipse', label: t('Ellipse'), icon: EllipseOutline },
	{ id: 'arrow', label: t('Arrow'), icon: ArrowTopRight },
	{ id: 'text', label: t('Text'), icon: FormatText },
]

type AdjustmentKey = 'brightness' | 'contrast' | 'saturation'
const adjustments: { id: AdjustmentKey, label: string, icon: unknown }[] = [
	{ id: 'brightness', label: t('Brightness'), icon: WhiteBalanceSunny },
	{ id: 'contrast', label: t('Contrast'), icon: ContrastCircle },
	{ id: 'saturation', label: t('Saturation'), icon: InvertColors },
]
const activeAdjustment = shallowRef<AdjustmentKey>('brightness')

type CropControl = 'rotation' | 'scale'
const cropControls: { id: CropControl, label: string }[] = [
	{ id: 'rotation', label: t('Rotation') },
	{ id: 'scale', label: t('Scale') },
]
const activeCropControl = shallowRef<CropControl>('rotation')

const presets: { id: FilterPreset, label: string }[] = [
	{ id: 'none', label: t('No filter') },
	{ id: 'pop', label: t('Pop') },
	{ id: 'warm', label: t('Warm') },
	{ id: 'cool', label: t('Cool') },
	{ id: 'fade', label: t('Fade') },
	{ id: 'grayscale', label: t('Grayscale') },
	{ id: 'noir', label: t('Noir') },
	{ id: 'sepia', label: t('Sepia') },
	{ id: 'invert', label: t('Invert') },
	{ id: 'solarize', label: t('Solarize') },
	{ id: 'posterize', label: t('Posterize') },
]

// Live preview chips: each preset applied to the current image
const presetPreviews = computed(() => {
	if (context.activeMode.value !== 'filter' || !props.oriented) {
		return []
	}
	return presets.map((preset) => ({
		...preset,
		url: presetThumbnail(props.oriented!, context.state.value, preset.id),
	}))
})

const showStrokeOptions = computed(() => ['draw', 'rectangle', 'ellipse', 'arrow'].includes(context.activeTool.value))

const adjustDisplay = computed(() => {
	const value = context.state.value.adjustments[activeAdjustment.value]
	return value > 0 ? `+${value}` : `${value}`
})

const cropDisplay = computed(() => activeCropControl.value === 'rotation'
	? `${context.state.value.fineRotation}°`
	: `×${context.state.value.zoom.toFixed(2)}`)

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
 * Record the current preview as one undo step when a slider is released.
 */
function onSliderCommit() {
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
	<!-- Filter mode gets a vertical preview strip, everything else the
		bottom control card -->
	<GlassSurface
		v-if="context.activeMode.value === 'filter'"
		variant="strip"
		class="editor-strip">
		<PresetChip
			v-for="preset in presetPreviews"
			:key="preset.id"
			:url="preset.url"
			:label="preset.label"
			:active="context.state.value.preset === preset.id"
			:disabled="!loaded"
			:data-test="`preset-${preset.id}`"
			@click="setPreset(preset.id)" />
	</GlassSurface>

	<GlassSurface v-else variant="card" class="editor-card">
		<!-- Crop -->
		<template v-if="context.activeMode.value === 'crop'">
			<div class="editor-card__tabs">
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
			<div class="editor-card__tabs">
				<NcButton
					:aria-label="labels.rotateLeft"
					:title="labels.rotateLeft"
					:disabled="!loaded"
					variant="tertiary"
					@click="emit('rotateCcw')">
					<template #icon>
						<RotateLeft :size="20" />
					</template>
				</NcButton>
				<NcButton
					:aria-label="labels.rotateRight"
					:title="labels.rotateRight"
					:disabled="!loaded"
					variant="tertiary"
					@click="emit('rotateCw')">
					<template #icon>
						<RotateRight :size="20" />
					</template>
				</NcButton>
				<NcButton
					:aria-label="labels.flipHorizontal"
					:title="labels.flipHorizontal"
					:disabled="!loaded"
					variant="tertiary"
					@click="emit('flipHorizontal')">
					<template #icon>
						<FlipHorizontal :size="20" />
					</template>
				</NcButton>
				<NcButton
					:aria-label="labels.flipVertical"
					:title="labels.flipVertical"
					:disabled="!loaded"
					variant="tertiary"
					@click="emit('flipVertical')">
					<template #icon>
						<FlipVertical :size="20" />
					</template>
				</NcButton>

				<span class="editor-card__divider" />

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

				<span class="editor-card__divider" />

				<NcButton
					data-test="reset-crop"
					variant="tertiary"
					:disabled="!loaded || context.state.value.crop === null"
					@click="emit('resetCrop')">
					{{ labels.resetCrop }}
				</NcButton>
				<NcButton
					data-test="apply-crop"
					variant="secondary"
					:disabled="!loaded"
					@click="emit('applyCrop')">
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
				:display="cropDisplay"
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
				:display="cropDisplay"
				data-test="zoom"
				:disabled="!loaded"
				@input="onTransformInput"
				@commit="onSliderCommit" />
		</template>

		<!-- Adjust -->
		<template v-else-if="context.activeMode.value === 'finetune'">
			<div class="editor-card__tabs">
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
				:display="adjustDisplay"
				:data-test="`adjust-${activeAdjustment}`"
				:disabled="!loaded"
				@input="onAdjustInput"
				@commit="onSliderCommit" />
		</template>

		<!-- Annotate -->
		<template v-else-if="context.activeMode.value === 'annotate'">
			<div class="editor-card__tabs">
				<NcButton
					v-for="tool in subTools"
					:key="tool.id"
					:aria-label="tool.label"
					:title="tool.label"
					:disabled="!loaded"
					:pressed="context.activeTool.value === tool.id"
					variant="tertiary"
					@click="context.activeTool.value = tool.id">
					<template #icon>
						<component :is="tool.icon" :size="20" />
					</template>
				</NcButton>

				<span class="editor-card__divider" />

				<label class="editor-card__option">
					{{ labels.color }}
					<!-- Native input: @nextcloud/vue offers no compact color field -->
					<input v-model="context.drawColor.value" type="color">
				</label>
			</div>
			<EditorSlider
				v-if="showStrokeOptions"
				:value="context.strokeWidth.value"
				:min="1"
				:max="32"
				:step="1"
				:aria-label="labels.strokeWidth"
				@input="context.strokeWidth.value = $event"
				@commit="() => {}" />
			<EditorSlider
				v-else-if="context.activeTool.value === 'text'"
				:value="context.fontSize.value"
				:min="8"
				:max="128"
				:step="1"
				:aria-label="labels.fontSize"
				@input="context.fontSize.value = $event"
				@commit="() => {}" />
		</template>

		<!-- Sticker -->
		<div v-else-if="context.activeMode.value === 'sticker'" class="editor-card__tabs">
			<NcButton
				v-for="sticker in STICKERS"
				:key="sticker"
				:aria-label="sticker"
				:pressed="context.sticker.value === sticker"
				variant="tertiary"
				@click="context.sticker.value = sticker">
				{{ sticker }}
			</NcButton>
		</div>

		<!-- Redact -->
		<div v-else-if="context.activeMode.value === 'redact'" class="editor-card__tabs">
			<NcButton
				data-test="redact-pixelate"
				:pressed="context.redactStyle.value === 'pixelate'"
				:disabled="!loaded"
				variant="tertiary"
				@click="context.redactStyle.value = 'pixelate'">
				{{ labels.pixelate }}
			</NcButton>
			<NcButton
				data-test="redact-blur"
				:pressed="context.redactStyle.value === 'blur'"
				:disabled="!loaded"
				variant="tertiary"
				@click="context.redactStyle.value = 'blur'">
				{{ labels.blur }}
			</NcButton>
		</div>
	</GlassSurface>
</template>

<style scoped lang="scss">
.editor-card {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: calc(var(--default-grid-baseline) * 2);
	min-width: min(420px, 92cqw);
	max-width: min(680px, 94cqw);
	padding: calc(var(--default-grid-baseline) * 3) calc(var(--default-grid-baseline) * 5);

	@container editor (max-width: 600px) {
		min-width: 0;
		width: 100%;
		max-width: none;
		padding-inline: calc(var(--default-grid-baseline) * 3);
	}

	&__tabs {
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

	&__option {
		display: flex;
		align-items: center;
		gap: var(--default-grid-baseline);
		font-size: 12px;
		opacity: 0.9;
	}
}

.editor-strip {
	display: flex;
	flex-direction: column;
	gap: calc(var(--default-grid-baseline) * 2);
	padding: calc(var(--default-grid-baseline) * 2);
	overflow-y: auto;
	max-height: 100%;

	@container editor (max-width: 600px) {
		flex-direction: row;
		overflow-y: hidden;
		overflow-x: auto;
	}
}
</style>
