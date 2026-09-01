<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Tool } from '../editor/context.ts'
import type { FilterPreset } from '../editor/state.ts'

import { computed } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import ArrowTopRight from 'vue-material-design-icons/ArrowTopRight.vue'
import CursorDefaultOutline from 'vue-material-design-icons/CursorDefaultOutline.vue'
import Delete from 'vue-material-design-icons/Delete.vue'
import EllipseOutline from 'vue-material-design-icons/EllipseOutline.vue'
import FlipHorizontal from 'vue-material-design-icons/FlipHorizontal.vue'
import FlipVertical from 'vue-material-design-icons/FlipVertical.vue'
import FormatText from 'vue-material-design-icons/FormatText.vue'
import Pencil from 'vue-material-design-icons/Pencil.vue'
import RectangleOutline from 'vue-material-design-icons/RectangleOutline.vue'
import RotateLeft from 'vue-material-design-icons/RotateLeft.vue'
import RotateRight from 'vue-material-design-icons/RotateRight.vue'
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
	deleteSelection: []
}>()

const context = useEditorContext()

const STICKERS = ['😀', '😍', '🎉', '👍', '❤️', '⭐', '🔥', '💡', '✅', '❌', '❓', '⚠️']

const labels = {
	transform: t('Transform'),
	rotation: t('Rotation'),
	scale: t('Scale'),
	rotateLeft: t('Rotate left'),
	rotateRight: t('Rotate right'),
	flipHorizontal: t('Flip horizontal'),
	flipVertical: t('Flip vertical'),
	applyCrop: t('Apply crop'),
	resetCrop: t('Reset crop'),
	light: t('Light'),
	brightness: t('Brightness'),
	contrast: t('Contrast'),
	saturation: t('Saturation'),
	tool: t('Tool'),
	color: t('Color'),
	strokeWidth: t('Stroke width'),
	fontSize: t('Font size'),
	selection: t('Selection'),
	deleteSelection: t('Delete selection'),
	sticker: t('Sticker'),
	style: t('Style'),
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

const adjustments = [
	{ id: 'brightness', label: labels.brightness },
	{ id: 'contrast', label: labels.contrast },
	{ id: 'saturation', label: labels.saturation },
] as const

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
 * Live-preview an adjustment while its slider is dragged.
 *
 * @param key the adjustment to change
 * @param event the range input event
 */
function onAdjustInput(key: 'brightness' | 'contrast' | 'saturation', event: Event) {
	const value = Number((event.target as HTMLInputElement).value)
	const state = context.state.value
	context.preview({ ...state, adjustments: { ...state.adjustments, [key]: value } })
}

/**
 * Live-preview fine rotation or zoom while its slider is dragged.
 *
 * @param key which transform value to change
 * @param event the range input event
 */
function onTransformInput(key: 'fineRotation' | 'zoom', event: Event) {
	const value = Number((event.target as HTMLInputElement).value)
	context.preview({ ...context.state.value, [key]: value })
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
	<aside class="editor-panel">
		<!-- Crop: transform sliders and orientation actions -->
		<template v-if="context.activeMode.value === 'crop'">
			<section class="editor-panel__section">
				<h3>{{ labels.transform }}</h3>
				<div class="editor-panel__grid">
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
				</div>

				<label class="editor-panel__row">
					<span>{{ labels.rotation }}</span>
					<output>{{ context.state.value.fineRotation }}°</output>
					<input
						:value="context.state.value.fineRotation"
						data-test="fine-rotation"
						:disabled="!loaded"
						type="range"
						min="-45"
						max="45"
						step="1"
						@input="onTransformInput('fineRotation', $event)"
						@change="onSliderCommit">
				</label>
				<label class="editor-panel__row">
					<span>{{ labels.scale }}</span>
					<output>×{{ context.state.value.zoom.toFixed(2) }}</output>
					<input
						:value="context.state.value.zoom"
						data-test="zoom"
						:disabled="!loaded"
						type="range"
						min="1"
						max="3"
						step="0.05"
						@input="onTransformInput('zoom', $event)"
						@change="onSliderCommit">
				</label>
			</section>
			<section class="editor-panel__section editor-panel__section--actions">
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
			</section>
		</template>

		<!-- Finetune: all adjustment sliders stacked -->
		<section v-else-if="context.activeMode.value === 'finetune'" class="editor-panel__section">
			<h3>{{ labels.light }}</h3>
			<label
				v-for="adjustment in adjustments"
				:key="adjustment.id"
				class="editor-panel__row">
				<span>{{ adjustment.label }}</span>
				<output>{{ context.state.value.adjustments[adjustment.id] > 0 ? '+' : '' }}{{ context.state.value.adjustments[adjustment.id] }}</output>
				<input
					:value="context.state.value.adjustments[adjustment.id]"
					:data-test="`adjust-${adjustment.id}`"
					:disabled="!loaded"
					type="range"
					min="-100"
					max="100"
					step="1"
					@input="onAdjustInput(adjustment.id, $event)"
					@change="onSliderCommit">
			</label>
		</section>

		<!-- Filter: preset preview grid -->
		<section v-else-if="context.activeMode.value === 'filter'" class="editor-panel__section">
			<div class="editor-panel__chips">
				<button
					v-for="preset in presetPreviews"
					:key="preset.id"
					type="button"
					class="editor-panel__chip"
					:class="{ 'editor-panel__chip--active': context.state.value.preset === preset.id }"
					:data-test="`preset-${preset.id}`"
					:disabled="!loaded"
					:aria-pressed="context.state.value.preset === preset.id"
					@click="setPreset(preset.id)">
					<img :src="preset.url" alt="">
					<span>{{ preset.label }}</span>
				</button>
			</div>
		</section>

		<!-- Annotate: sub-tools plus stroke options -->
		<template v-else-if="context.activeMode.value === 'annotate'">
			<section class="editor-panel__section">
				<h3>{{ labels.tool }}</h3>
				<div class="editor-panel__grid">
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
				</div>
				<label class="editor-panel__row editor-panel__row--inline">
					<span>{{ labels.color }}</span>
					<!-- Native input: @nextcloud/vue offers no compact color field -->
					<input v-model="context.drawColor.value" type="color">
				</label>
				<label v-if="showStrokeOptions" class="editor-panel__row">
					<span>{{ labels.strokeWidth }}</span>
					<output>{{ context.strokeWidth.value }}</output>
					<input
						v-model.number="context.strokeWidth.value"
						type="range"
						min="1"
						max="32"
						step="1">
				</label>
				<label v-if="context.activeTool.value === 'text'" class="editor-panel__row">
					<span>{{ labels.fontSize }}</span>
					<output>{{ context.fontSize.value }}</output>
					<input
						v-model.number="context.fontSize.value"
						type="range"
						min="8"
						max="128"
						step="1">
				</label>
			</section>
			<section
				v-if="context.selectedId.value !== null"
				class="editor-panel__section editor-panel__section--actions">
				<NcButton variant="tertiary" @click="emit('deleteSelection')">
					<template #icon>
						<Delete :size="20" />
					</template>
					{{ labels.deleteSelection }}
				</NcButton>
			</section>
		</template>

		<!-- Sticker: emoji grid -->
		<section v-else-if="context.activeMode.value === 'sticker'" class="editor-panel__section">
			<h3>{{ labels.sticker }}</h3>
			<div class="editor-panel__grid">
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
		</section>

		<!-- Redact: obfuscation style -->
		<section v-else-if="context.activeMode.value === 'redact'" class="editor-panel__section">
			<h3>{{ labels.style }}</h3>
			<div class="editor-panel__grid">
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
		</section>
	</aside>
</template>

<style scoped lang="scss">
.editor-panel {
	width: 264px;
	flex-shrink: 0;
	overflow-y: auto;
	padding: calc(var(--default-grid-baseline) * 3);
	display: flex;
	flex-direction: column;
	gap: calc(var(--default-grid-baseline) * 4);
	border-inline-start: 1px solid var(--color-border);

	&__section {
		display: flex;
		flex-direction: column;
		gap: calc(var(--default-grid-baseline) * 2);

		h3 {
			margin: 0;
			font-size: 13px;
			font-weight: 600;
			opacity: 0.9;
		}

		&--actions {
			flex-direction: row;
			justify-content: flex-end;
			gap: var(--default-grid-baseline);
		}
	}

	&__grid {
		display: flex;
		flex-wrap: wrap;
		gap: var(--default-grid-baseline);
	}

	// "Label ······· value" row with a full-width slider below
	&__row {
		display: grid;
		grid-template-columns: 1fr auto;
		row-gap: 2px;
		font-size: 12px;

		span {
			opacity: 0.75;
		}

		output {
			font-variant-numeric: tabular-nums;
			opacity: 0.9;
		}

		input[type='range'] {
			grid-column: 1 / -1;
			appearance: none;
			width: 100%;
			height: 20px;
			margin: 0;
			background:
				linear-gradient(var(--color-border), var(--color-border)) center / 100% 2px no-repeat;
			cursor: ew-resize;

			&::-webkit-slider-thumb {
				appearance: none;
				width: 12px;
				height: 12px;
				border-radius: 50%;
				background: var(--color-main-text);
			}

			&::-moz-range-thumb {
				width: 12px;
				height: 12px;
				border: none;
				border-radius: 50%;
				background: var(--color-main-text);
			}

			&:focus-visible {
				outline: 2px solid var(--color-primary-element);
				outline-offset: 2px;
			}
		}

		&--inline {
			grid-template-columns: 1fr auto;
			align-items: center;
		}
	}

	&__chips {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: calc(var(--default-grid-baseline) * 2);
	}

	&__chip {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 0;
		border: none;
		background: transparent;
		color: var(--color-main-text);
		font-size: 11px;
		cursor: pointer;

		img {
			width: 100%;
			aspect-ratio: 4 / 3;
			object-fit: cover;
			border-radius: 8px;
			box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08);
			transition: transform 0.12s ease, box-shadow 0.12s ease;
		}

		&:hover img {
			transform: translateY(-1px);
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
