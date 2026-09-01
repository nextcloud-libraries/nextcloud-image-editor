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
import Crop from 'vue-material-design-icons/Crop.vue'
import CursorDefaultOutline from 'vue-material-design-icons/CursorDefaultOutline.vue'
import Delete from 'vue-material-design-icons/Delete.vue'
import EllipseOutline from 'vue-material-design-icons/EllipseOutline.vue'
import FlipHorizontal from 'vue-material-design-icons/FlipHorizontal.vue'
import FlipVertical from 'vue-material-design-icons/FlipVertical.vue'
import FormatText from 'vue-material-design-icons/FormatText.vue'
import Pencil from 'vue-material-design-icons/Pencil.vue'
import RectangleOutline from 'vue-material-design-icons/RectangleOutline.vue'
import Redo from 'vue-material-design-icons/Redo.vue'
import RotateLeft from 'vue-material-design-icons/RotateLeft.vue'
import RotateRight from 'vue-material-design-icons/RotateRight.vue'
import StickerEmoji from 'vue-material-design-icons/StickerEmoji.vue'
import Tune from 'vue-material-design-icons/Tune.vue'
import Undo from 'vue-material-design-icons/Undo.vue'
import { useEditorContext } from '../editor/context.ts'
import { t } from '../utils/l10n.ts'

defineProps<{
	/** Whether an image is loaded and the tools are usable */
	loaded: boolean
}>()

const emit = defineEmits<{
	rotateCcw: []
	rotateCw: []
	flipHorizontal: []
	flipVertical: []
	applyCrop: []
	resetCrop: []
	deleteSelection: []
	save: []
	cancel: []
}>()

const context = useEditorContext()

const STICKERS = ['😀', '😍', '🎉', '👍', '❤️', '⭐']

const labels = {
	select: t('Select'),
	draw: t('Draw'),
	rectangle: t('Rectangle'),
	ellipse: t('Ellipse'),
	arrow: t('Arrow'),
	text: t('Text'),
	sticker: t('Sticker'),
	crop: t('Crop'),
	adjust: t('Adjust'),
	rotateLeft: t('Rotate left'),
	rotateRight: t('Rotate right'),
	flipHorizontal: t('Flip horizontal'),
	flipVertical: t('Flip vertical'),
	undo: t('Undo'),
	redo: t('Redo'),
	deleteSelection: t('Delete selection'),
	applyCrop: t('Apply crop'),
	resetCrop: t('Reset crop'),
	color: t('Color'),
	strokeWidth: t('Stroke width'),
	fontSize: t('Font size'),
	brightness: t('Brightness'),
	contrast: t('Contrast'),
	saturation: t('Saturation'),
	presetNone: t('No filter'),
	presetGrayscale: t('Grayscale'),
	presetSepia: t('Sepia'),
	save: t('Save'),
	cancel: t('Cancel'),
}

const tools: { id: Tool, label: string, icon: unknown }[] = [
	{ id: 'select', label: labels.select, icon: CursorDefaultOutline },
	{ id: 'draw', label: labels.draw, icon: Pencil },
	{ id: 'rectangle', label: labels.rectangle, icon: RectangleOutline },
	{ id: 'ellipse', label: labels.ellipse, icon: EllipseOutline },
	{ id: 'arrow', label: labels.arrow, icon: ArrowTopRight },
	{ id: 'text', label: labels.text, icon: FormatText },
	{ id: 'sticker', label: labels.sticker, icon: StickerEmoji },
	{ id: 'crop', label: labels.crop, icon: Crop },
	{ id: 'adjust', label: labels.adjust, icon: Tune },
]

const presets: { id: FilterPreset, label: string }[] = [
	{ id: 'none', label: labels.presetNone },
	{ id: 'grayscale', label: labels.presetGrayscale },
	{ id: 'sepia', label: labels.presetSepia },
]

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
	<div class="editor-toolbar">
		<div class="editor-toolbar__row" role="toolbar" :aria-label="labels.adjust">
			<NcButton
				v-for="tool in tools"
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

			<span class="editor-toolbar__separator" />

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

			<span class="editor-toolbar__separator" />

			<NcButton
				:aria-label="labels.undo"
				:title="labels.undo"
				:disabled="!loaded || !context.canUndo.value"
				variant="tertiary"
				@click="context.undo()">
				<template #icon>
					<Undo :size="20" />
				</template>
			</NcButton>
			<NcButton
				:aria-label="labels.redo"
				:title="labels.redo"
				:disabled="!loaded || !context.canRedo.value"
				variant="tertiary"
				@click="context.redo()">
				<template #icon>
					<Redo :size="20" />
				</template>
			</NcButton>
			<NcButton
				v-if="context.selectedId.value !== null"
				:aria-label="labels.deleteSelection"
				:title="labels.deleteSelection"
				variant="tertiary"
				@click="emit('deleteSelection')">
				<template #icon>
					<Delete :size="20" />
				</template>
			</NcButton>

			<span class="editor-toolbar__spacer" />

			<NcButton data-test="cancel" @click="emit('cancel')">
				{{ labels.cancel }}
			</NcButton>
			<NcButton
				data-test="save"
				variant="primary"
				:disabled="!loaded"
				@click="emit('save')">
				{{ labels.save }}
			</NcButton>
		</div>

		<!-- Always rendered with a reserved height so the canvas below
			never jumps when switching tools -->
		<div class="editor-toolbar__row editor-toolbar__row--options">
			<template v-if="showStrokeOptions || context.activeTool.value === 'text'">
				<label class="editor-toolbar__option">
					{{ labels.color }}
					<!-- Native input: @nextcloud/vue offers no slider/color field fitting here -->
					<input v-model="context.drawColor.value" type="color">
				</label>
				<label v-if="showStrokeOptions" class="editor-toolbar__option">
					{{ labels.strokeWidth }}
					<input
						v-model.number="context.strokeWidth.value"
						type="range"
						min="1"
						max="32"
						step="1">
				</label>
				<label v-if="context.activeTool.value === 'text'" class="editor-toolbar__option">
					{{ labels.fontSize }}
					<input
						v-model.number="context.fontSize.value"
						type="range"
						min="8"
						max="128"
						step="1">
				</label>
			</template>

			<template v-else-if="context.activeTool.value === 'sticker'">
				<NcButton
					v-for="sticker in STICKERS"
					:key="sticker"
					:aria-label="sticker"
					:pressed="context.sticker.value === sticker"
					variant="tertiary"
					@click="context.sticker.value = sticker">
					{{ sticker }}
				</NcButton>
			</template>

			<template v-else-if="context.activeTool.value === 'adjust'">
				<label
					v-for="key in (['brightness', 'contrast', 'saturation'] as const)"
					:key="key"
					class="editor-toolbar__option">
					{{ labels[key] }}
					<input
						:value="context.state.value.adjustments[key]"
						:data-test="`adjust-${key}`"
						type="range"
						min="-100"
						max="100"
						step="1"
						@input="onAdjustInput(key, $event)"
						@change="onAdjustChange()">
				</label>
				<NcButton
					v-for="preset in presets"
					:key="preset.id"
					:pressed="context.state.value.preset === preset.id"
					:data-test="`preset-${preset.id}`"
					variant="tertiary"
					@click="setPreset(preset.id)">
					{{ preset.label }}
				</NcButton>
			</template>

			<template v-else-if="context.activeTool.value === 'crop'">
				<NcButton data-test="apply-crop" variant="primary" @click="emit('applyCrop')">
					{{ labels.applyCrop }}
				</NcButton>
				<NcButton
					data-test="reset-crop"
					:disabled="context.state.value.crop === null"
					@click="emit('resetCrop')">
					{{ labels.resetCrop }}
				</NcButton>
			</template>
		</div>
	</div>
</template>

<style scoped lang="scss">
.editor-toolbar {
	display: flex;
	flex-direction: column;
	gap: var(--default-grid-baseline);
	padding: var(--default-grid-baseline) calc(var(--default-grid-baseline) * 2);

	&__row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--default-grid-baseline);

		&--options {
			min-height: 44px;
		}
	}

	&__separator {
		width: 1px;
		height: 24px;
		background-color: var(--color-border, #ddd);
	}

	&__spacer {
		flex: 1;
	}

	&__option {
		display: flex;
		align-items: center;
		gap: var(--default-grid-baseline);
	}
}
</style>
