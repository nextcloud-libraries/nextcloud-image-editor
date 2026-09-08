<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Tool } from '../../editor/context.ts'

import { computed } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import ArrowTopRight from 'vue-material-design-icons/ArrowTopRight.vue'
import EllipseOutline from 'vue-material-design-icons/EllipseOutline.vue'
import FormatText from 'vue-material-design-icons/FormatText.vue'
import Pencil from 'vue-material-design-icons/Pencil.vue'
import RectangleOutline from 'vue-material-design-icons/RectangleOutline.vue'
import VectorLine from 'vue-material-design-icons/VectorLine.vue'
import EditorSlider from '../base/EditorSlider.vue'
import { useAnnotationColor } from '../../composables/useAnnotationColor.ts'
import { useTextStyle } from '../../composables/useTextStyle.ts'
import { useEditorContext } from '../../editor/context.ts'
import { FONT_STACKS } from '../../editor/fonts.ts'
import { t } from '../../utils/l10n.ts'

defineProps<{
	/** Whether an image is loaded and the tools are usable */
	loaded: boolean
}>()

const context = useEditorContext()
const color = useAnnotationColor(context)
const textStyle = useTextStyle(context)

// Named for what they look like rather than for the faces behind them,
// which differ per machine
const fonts: { id: keyof typeof FONT_STACKS, label: string }[] = [
	{ id: 'sans', label: t('Sans serif') },
	{ id: 'serif', label: t('Serif') },
	{ id: 'mono', label: t('Monospace') },
]

const labels = {
	color: t('Color'),
	strokeWidth: t('Stroke width'),
	fontSize: t('Font size'),
	outline: t('Outline'),
	background: t('Background'),
	font: t('Font'),
}

// Stands in for the text being sized. Deliberately not translated: it
// is a glyph whose shape shows a size, not a word to read.
const FONT_SAMPLE = 'A'

const subTools: { id: Tool, label: string, icon: unknown }[] = [
	{ id: 'draw', label: t('Draw'), icon: Pencil },
	{ id: 'rectangle', label: t('Rectangle'), icon: RectangleOutline },
	{ id: 'ellipse', label: t('Ellipse'), icon: EllipseOutline },
	{ id: 'arrow', label: t('Arrow'), icon: ArrowTopRight },
	{ id: 'line', label: t('Line'), icon: VectorLine },
	{ id: 'text', label: t('Text'), icon: FormatText },
]

const showStrokeOptions = computed(() => ['draw', 'rectangle', 'ellipse', 'arrow', 'line'].includes(context.activeTool.value))

// Also while a caption is selected, which is when someone finds out it
// needed an edge. Selecting one means leaving the text tool, so keying
// this on the tool alone would hide the switches exactly then.
const showTextOptions = computed(() => context.activeTool.value === 'text'
	|| context.state.value.annotations
		.some((entry) => entry.id === context.selectedId.value && entry.type === 'text'))

/** Largest preview that still fits the control card */
const PREVIEW_CAP = 44

/** On-screen pixels per image pixel, so previews match the canvas */
const viewScale = computed(() => (context.viewFit.value?.scale ?? 1) * context.viewZoom.value)

// Stroke width and font size are image pixels, which say nothing on
// their own: show the mark at the size it will be drawn instead
const strokePreview = computed(() => Math.min(PREVIEW_CAP, Math.max(2, context.strokeWidth.value * viewScale.value)))
const fontPreview = computed(() => Math.min(PREVIEW_CAP, Math.max(8, context.fontSize.value * viewScale.value)))
</script>

<template>
	<div class="annotate-panel">
		<div class="annotate-panel__row">
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

			<span class="annotate-panel__divider" />

			<label class="annotate-panel__option">
				{{ labels.color }}
				<!-- Native input: @nextcloud/vue offers no compact color field -->
				<input
					:value="context.drawColor.value"
					type="color"
					data-test="color"
					@input="color.preview(($event.target as HTMLInputElement).value)"
					@change="color.commit(($event.target as HTMLInputElement).value)">
			</label>
		</div>
		<EditorSlider
			v-if="showStrokeOptions"
			:value="context.strokeWidth.value"
			:min="1"
			:max="32"
			:step="1"
			:label="labels.strokeWidth"
			@input="context.strokeWidth.value = $event"
			@commit="() => {}">
			<template #preview>
				<span
					class="annotate-panel__dot"
					data-test="stroke-preview"
					:style="{
						inlineSize: `${strokePreview}px`,
						blockSize: `${strokePreview}px`,
						backgroundColor: context.drawColor.value,
					}" />
			</template>
		</EditorSlider>
		<EditorSlider
			v-else-if="context.activeTool.value === 'text'"
			:value="context.fontSize.value"
			:min="8"
			:max="128"
			:step="1"
			:label="labels.fontSize"
			@input="context.fontSize.value = $event"
			@commit="() => {}">
			<template #preview>
				<span
					class="annotate-panel__glyph"
					data-test="font-preview"
					:style="{
						fontSize: `${fontPreview}px`,
						color: context.drawColor.value,
					}">{{ FONT_SAMPLE }}</span>
			</template>
		</EditorSlider>
		<label v-if="showTextOptions" class="annotate-panel__field">
			{{ labels.font }}
			<select
				v-model="textStyle.font.value"
				class="annotate-panel__select"
				data-test="text-font">
				<option
					v-for="entry in fonts"
					:key="entry.id"
					:value="entry.id"
					:style="{ fontFamily: FONT_STACKS[entry.id] }">{{ entry.label }}</option>
			</select>
		</label>
		<label
			v-if="showTextOptions"
			class="annotate-panel__toggle">
			<input
				v-model="textStyle.outline.value"
				type="checkbox"
				data-test="text-outline">
			{{ labels.outline }}
		</label>
		<label
			v-if="showTextOptions"
			class="annotate-panel__toggle">
			<input
				v-model="textStyle.background.value"
				type="checkbox"
				data-test="text-background">
			{{ labels.background }}
		</label>
	</div>
</template>

<style scoped lang="scss">
.annotate-panel {
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

	&__option {
		display: flex;
		align-items: center;
		gap: var(--default-grid-baseline);
		font-size: 12px;
		opacity: 0.9;
	}

	// A ring so the mark stays visible whatever color it is drawn in
	&__field {
		display: flex;
		gap: var(--default-grid-baseline);
		align-items: center;
		color: var(--color-main-text);
		font-size: 13px;
	}

	&__select {
		border-radius: var(--border-radius);
		border: 1px solid var(--color-border-maxcontrast);
		background: var(--color-main-background);
		color: var(--color-main-text);
		padding: 2px 4px;
	}

	&__toggle {
		display: flex;
		gap: var(--default-grid-baseline);
		align-items: center;
		color: var(--color-main-text);
		font-size: 13px;
		cursor: pointer;
	}

	&__dot {
		display: block;
		border-radius: 50%;
		box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.5);
	}

	&__glyph {
		// Matches the canvas text nodes so the sample is honest
		font-family: Helvetica, Arial, sans-serif;
		line-height: 1;
		text-shadow: 0 0 2px rgba(0, 0, 0, 0.6);
	}
}
</style>
