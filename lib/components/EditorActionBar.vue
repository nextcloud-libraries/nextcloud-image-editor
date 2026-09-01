<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Tool } from '../editor/context.ts'

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
}>()

const context = useEditorContext()

const STICKERS = ['😀', '😍', '🎉', '👍', '❤️', '⭐']

const labels = {
	rotateLeft: t('Rotate left'),
	rotateRight: t('Rotate right'),
	flipHorizontal: t('Flip horizontal'),
	flipVertical: t('Flip vertical'),
	applyCrop: t('Apply crop'),
	resetCrop: t('Reset crop'),
	deleteSelection: t('Delete selection'),
	color: t('Color'),
	strokeWidth: t('Stroke width'),
	fontSize: t('Font size'),
}

const subTools: { id: Tool, label: string, icon: unknown }[] = [
	{ id: 'select', label: t('Select'), icon: CursorDefaultOutline },
	{ id: 'draw', label: t('Draw'), icon: Pencil },
	{ id: 'rectangle', label: t('Rectangle'), icon: RectangleOutline },
	{ id: 'ellipse', label: t('Ellipse'), icon: EllipseOutline },
	{ id: 'arrow', label: t('Arrow'), icon: ArrowTopRight },
	{ id: 'text', label: t('Text'), icon: FormatText },
]

const showStrokeOptions = computed(() => ['draw', 'rectangle', 'ellipse', 'arrow'].includes(context.activeTool.value))
</script>

<template>
	<div class="editor-actionbar">
		<Transition name="editor-fade" mode="out-in">
			<div
				v-if="context.activeMode.value === 'crop'"
				key="crop"
				class="editor-actionbar__row">
				<NcButton variant="tertiary" :disabled="!loaded" @click="emit('rotateCcw')">
					<template #icon>
						<RotateLeft :size="20" />
					</template>
					{{ labels.rotateLeft }}
				</NcButton>
				<NcButton variant="tertiary" :disabled="!loaded" @click="emit('rotateCw')">
					<template #icon>
						<RotateRight :size="20" />
					</template>
					{{ labels.rotateRight }}
				</NcButton>
				<NcButton variant="tertiary" :disabled="!loaded" @click="emit('flipHorizontal')">
					<template #icon>
						<FlipHorizontal :size="20" />
					</template>
					{{ labels.flipHorizontal }}
				</NcButton>
				<NcButton variant="tertiary" :disabled="!loaded" @click="emit('flipVertical')">
					<template #icon>
						<FlipVertical :size="20" />
					</template>
					{{ labels.flipVertical }}
				</NcButton>

				<span class="editor-actionbar__spacer" />

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

			<div
				v-else-if="context.activeMode.value === 'annotate'"
				key="annotate"
				class="editor-actionbar__row">
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

				<span class="editor-actionbar__separator" />

				<label class="editor-actionbar__option">
					{{ labels.color }}
					<!-- Native input: @nextcloud/vue offers no compact color field -->
					<input v-model="context.drawColor.value" type="color">
				</label>
				<label v-if="showStrokeOptions" class="editor-actionbar__option">
					{{ labels.strokeWidth }}
					<input
						v-model.number="context.strokeWidth.value"
						type="range"
						min="1"
						max="32"
						step="1">
				</label>
				<label v-if="context.activeTool.value === 'text'" class="editor-actionbar__option">
					{{ labels.fontSize }}
					<input
						v-model.number="context.fontSize.value"
						type="range"
						min="8"
						max="128"
						step="1">
				</label>

				<template v-if="context.selectedId.value !== null">
					<span class="editor-actionbar__spacer" />
					<NcButton
						:aria-label="labels.deleteSelection"
						:title="labels.deleteSelection"
						variant="tertiary"
						@click="emit('deleteSelection')">
						<template #icon>
							<Delete :size="20" />
						</template>
					</NcButton>
				</template>
			</div>

			<div
				v-else-if="context.activeMode.value === 'sticker'"
				key="sticker"
				class="editor-actionbar__row">
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

			<div v-else key="none" class="editor-actionbar__row" />
		</Transition>
	</div>
</template>

<style scoped lang="scss">
.editor-actionbar {
	// Constant height so the canvas never jumps when switching modes
	min-height: 44px;
	display: flex;
	justify-content: center;

	&__row {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		gap: var(--default-grid-baseline);
		width: 100%;
		padding-inline: calc(var(--default-grid-baseline) * 2);
	}

	&__separator {
		width: 1px;
		height: 24px;
		background-color: var(--color-border);
	}

	&__spacer {
		flex: 1;
	}

	&__option {
		display: flex;
		align-items: center;
		gap: var(--default-grid-baseline);

		input[type='range'] {
			accent-color: var(--color-primary-element);
		}
	}
}

.editor-fade-enter-active,
.editor-fade-leave-active {
	transition: opacity 0.15s ease, transform 0.15s ease;
}

.editor-fade-enter-from,
.editor-fade-leave-to {
	opacity: 0;
	transform: translateY(-2px);
}

@media (prefers-reduced-motion: reduce) {
	.editor-fade-enter-active,
	.editor-fade-leave-active {
		transition: none;
	}
}
</style>
