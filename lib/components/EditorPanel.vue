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
	{ id: 'grayscale', label: t('Grayscale') },
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

/**
 * Live-preview the active adjustment while the slider is dragged.
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
 * Live-preview fine rotation or zoom while the slider is dragged.
 *
 * @param event the range input event
 */
function onTransformInput(event: Event) {
	const value = Number((event.target as HTMLInputElement).value)
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
	<div v-if="context.activeMode.value === 'filter'" class="editor-strip">
		<button
			v-for="preset in presetPreviews"
			:key="preset.id"
			type="button"
			class="editor-strip__chip"
			:class="{ 'editor-strip__chip--active': context.state.value.preset === preset.id }"
			:data-test="`preset-${preset.id}`"
			:disabled="!loaded"
			:aria-pressed="context.state.value.preset === preset.id"
			:title="preset.label"
			@click="setPreset(preset.id)">
			<img :src="preset.url" :alt="preset.label">
			<span>{{ preset.label }}</span>
		</button>
	</div>

	<div v-else class="editor-card">
		<!-- Crop -->
		<template v-if="context.activeMode.value === 'crop'">
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
			<div class="editor-card__slider">
				<input
					v-if="activeCropControl === 'rotation'"
					:value="context.state.value.fineRotation"
					data-test="fine-rotation"
					:disabled="!loaded"
					:aria-label="labels.rotation"
					type="range"
					min="-45"
					max="45"
					step="1"
					@input="onTransformInput"
					@change="onSliderCommit">
				<input
					v-else
					:value="context.state.value.zoom"
					data-test="zoom"
					:disabled="!loaded"
					:aria-label="labels.scale"
					type="range"
					min="1"
					max="3"
					step="0.05"
					@input="onTransformInput"
					@change="onSliderCommit">
				<output>{{
					activeCropControl === 'rotation'
						? `${context.state.value.fineRotation}°`
						: `×${context.state.value.zoom.toFixed(2)}`
				}}</output>
			</div>
		</template>

		<!-- Adjust -->
		<template v-else-if="context.activeMode.value === 'finetune'">
			<div class="editor-card__tabs">
				<button
					v-for="adjustment in adjustments"
					:key="adjustment.id"
					type="button"
					class="editor-card__tab"
					:class="{ 'editor-card__tab--active': activeAdjustment === adjustment.id }"
					:data-test="`tab-${adjustment.id}`"
					:disabled="!loaded"
					:aria-pressed="activeAdjustment === adjustment.id"
					@click="activeAdjustment = adjustment.id">
					<component :is="adjustment.icon" :size="20" />
					<span>{{ adjustment.label }}</span>
				</button>
			</div>
			<div class="editor-card__slider">
				<input
					:value="context.state.value.adjustments[activeAdjustment]"
					:data-test="`adjust-${activeAdjustment}`"
					:disabled="!loaded"
					:aria-label="adjustments.find((entry) => entry.id === activeAdjustment)!.label"
					type="range"
					min="-100"
					max="100"
					step="1"
					@input="onAdjustInput"
					@change="onSliderCommit">
				<output>{{ context.state.value.adjustments[activeAdjustment] > 0 ? '+' : '' }}{{ context.state.value.adjustments[activeAdjustment] }}</output>
			</div>
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
			<div v-if="showStrokeOptions" class="editor-card__slider">
				<input
					v-model.number="context.strokeWidth.value"
					:aria-label="labels.strokeWidth"
					type="range"
					min="1"
					max="32"
					step="1">
				<output>{{ context.strokeWidth.value }}</output>
			</div>
			<div v-else-if="context.activeTool.value === 'text'" class="editor-card__slider">
				<input
					v-model.number="context.fontSize.value"
					:aria-label="labels.fontSize"
					type="range"
					min="8"
					max="128"
					step="1">
				<output>{{ context.fontSize.value }}</output>
			</div>
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
	</div>
</template>

<style scoped lang="scss">
%glass {
	background: var(--editor-glass, rgba(22, 22, 26, 0.65));
	backdrop-filter: blur(24px) saturate(1.4);
	border: 1px solid rgba(255, 255, 255, 0.09);
	box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
}

.editor-card {
	@extend %glass;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: calc(var(--default-grid-baseline) * 2);
	min-width: 420px;
	max-width: min(680px, 90%);
	padding: calc(var(--default-grid-baseline) * 3) calc(var(--default-grid-baseline) * 5);
	border-radius: 20px;

	&__tabs {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		gap: calc(var(--default-grid-baseline) * 2);
	}

	// Icon-above-label adjustment tab, reference style
	&__tab {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		min-width: 64px;
		padding: calc(var(--default-grid-baseline) * 2) var(--default-grid-baseline);
		border: none;
		border-radius: var(--border-radius-large, 12px);
		background: transparent;
		color: var(--color-main-text);
		font-size: 11px;
		cursor: pointer;
		transition: background-color 0.12s ease, color 0.12s ease;

		&:hover:not(:disabled) {
			background-color: rgba(255, 255, 255, 0.07);
		}

		&--active {
			background-color: rgba(255, 255, 255, 0.1);
		}

		&:focus-visible {
			outline: 2px solid var(--color-primary-element);
			outline-offset: 2px;
		}

		&:disabled {
			opacity: 0.5;
			cursor: default;
		}
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

	// Thin line slider with a round thumb and the value to its right
	&__slider {
		display: flex;
		align-items: center;
		gap: calc(var(--default-grid-baseline) * 3);
		width: 100%;

		input[type='range'] {
			appearance: none;
			flex: 1;
			height: 20px;
			margin: 0;
			background: linear-gradient(rgba(255, 255, 255, 0.25), rgba(255, 255, 255, 0.25)) center / 100% 2px no-repeat;
			cursor: ew-resize;

			&::-webkit-slider-thumb {
				appearance: none;
				width: 14px;
				height: 14px;
				border-radius: 50%;
				background: #fff;
				box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
			}

			&::-moz-range-thumb {
				width: 14px;
				height: 14px;
				border: none;
				border-radius: 50%;
				background: #fff;
				box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
			}

			&:focus-visible {
				outline: 2px solid var(--color-primary-element);
				outline-offset: 2px;
			}
		}

		output {
			min-width: 44px;
			text-align: end;
			font-size: 13px;
			font-variant-numeric: tabular-nums;
		}
	}
}

// Vertical preset strip on the right, the reference's layer-strip style
.editor-strip {
	@extend %glass;
	display: flex;
	flex-direction: column;
	gap: calc(var(--default-grid-baseline) * 2);
	padding: calc(var(--default-grid-baseline) * 2);
	border-radius: 16px;
	overflow-y: auto;
	max-height: 100%;

	&__chip {
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
}
</style>
