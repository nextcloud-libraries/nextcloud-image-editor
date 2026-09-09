<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Component } from 'vue'
import type { FONT_STACKS } from '../editor/fonts.ts'
import type { TextAlign } from '../editor/text-align.ts'

import { computed } from 'vue'
import NcActionButton from '@nextcloud/vue/components/NcActionButton'
import NcActions from '@nextcloud/vue/components/NcActions'
import NcButton from '@nextcloud/vue/components/NcButton'
import BorderOutside from 'vue-material-design-icons/BorderOutside.vue'
import ContentCopy from 'vue-material-design-icons/ContentCopy.vue'
import Delete from 'vue-material-design-icons/Delete.vue'
import FormatAlignCenter from 'vue-material-design-icons/FormatAlignCenter.vue'
import FormatAlignLeft from 'vue-material-design-icons/FormatAlignLeft.vue'
import FormatAlignRight from 'vue-material-design-icons/FormatAlignRight.vue'
import FormatColorHighlight from 'vue-material-design-icons/FormatColorHighlight.vue'
import FormatFont from 'vue-material-design-icons/FormatFont.vue'
import GlassSurface from './base/GlassSurface.vue'
import TextEmphasisButtons from './base/TextEmphasisButtons.vue'
import { useAnnotationColor } from '../composables/useAnnotationColor.ts'
import { useTextStyle } from '../composables/useTextStyle.ts'
import { useEditorContext } from '../editor/context.ts'
import { TEXT_ALIGNS, textAlign } from '../editor/text-align.ts'
import { t } from '../utils/l10n.ts'

const props = defineProps<{
	/** Stage-space bounds of what the bar hangs off: the selection or the text being typed */
	box: { x: number, y: number, width: number, height: number }
	/** Whether the text overlay is open, which is when the bar styles what is being typed */
	typing?: boolean
}>()

const emit = defineEmits<{
	duplicate: []
	delete: []
	/** A menu closed and took the focus with it */
	refocus: []
}>()

const context = useEditorContext()
const color = useAnnotationColor(context)
const textStyle = useTextStyle(context)

const selected = computed(() => context.state.value.annotations
	.find((entry) => entry.id === context.selectedId.value))

// Text being typed has no annotation yet: the controls then set the
// defaults the overlay is drawn with
const isText = computed(() => props.typing === true || selected.value?.type === 'text')

// Stickers render the emoji glyph and redactions destroy pixels:
// neither has a visible color, so the picker would mislead
const recolorable = computed(() => props.typing === true
	|| (selected.value !== undefined
		&& selected.value.type !== 'sticker'
		&& selected.value.type !== 'redact'))

// Above the anchor as designed, clearing the transformer's rotate
// handle; the overlay has no handle, so the bar sits closer to it
const lift = computed(() => props.typing === true ? 52 : 76)

const labels = {
	color: t('Color'),
	duplicate: t('Duplicate'),
	delete: t('Delete'),
	outline: t('Outline'),
	background: t('Background'),
	font: t('Font'),
	align: t('Alignment'),
}

// Named for what they look like rather than for the faces behind them,
// which differ per machine
const fonts: { id: keyof typeof FONT_STACKS, label: string }[] = [
	{ id: 'sans', label: t('Sans serif') },
	{ id: 'serif', label: t('Serif') },
	{ id: 'mono', label: t('Monospace') },
]

const ALIGN_META: Record<TextAlign, { label: string, icon: Component }> = {
	left: { label: t('Align left'), icon: FormatAlignLeft },
	center: { label: t('Align centre'), icon: FormatAlignCenter },
	right: { label: t('Align right'), icon: FormatAlignRight },
}

const alignments = TEXT_ALIGNS.map((id) => ({ id, ...ALIGN_META[id] }))

/** The chosen alignment, so the trigger shows what the text is on */
const alignment = computed(() => ALIGN_META[textAlign(textStyle.align.value)])
</script>

<template>
	<!-- Pressing a button must not take the focus off the text overlay,
	     or the next keystroke would go nowhere -->
	<GlassSurface
		variant="pill"
		class="floating-toolbar"
		data-test="floating-toolbar"
		:style="{
			insetInlineStart: `${box.x + box.width / 2}px`,
			// Below only when the top edge would clip the bar
			insetBlockStart: box.y - lift >= 4
				? `${box.y - lift}px`
				: `${box.y + box.height + 12}px`,
		}"
		@mousedown.prevent>
		<span v-if="recolorable" class="floating-toolbar__color">
			<!-- Native input: @nextcloud/vue offers no compact color field -->
			<input
				:value="context.drawColor.value"
				type="color"
				:aria-label="labels.color"
				:title="labels.color"
				data-test="toolbar-color"
				@input="color.preview(($event.target as HTMLInputElement).value)"
				@change="color.commit(($event.target as HTMLInputElement).value)">
		</span>
		<NcActions
			v-if="isText"
			forceMenu
			:aria-label="labels.font"
			:title="labels.font"
			variant="tertiary"
			data-test="toolbar-font"
			@close="emit('refocus')">
			<template #icon>
				<FormatFont :size="18" />
			</template>
			<NcActionButton
				v-for="entry in fonts"
				:key="entry.id"
				type="radio"
				closeAfterClick
				:modelValue="textStyle.font.value"
				:value="entry.id"
				:data-test="`toolbar-font-${entry.id}`"
				@click="textStyle.font.value = entry.id">
				{{ entry.label }}
			</NcActionButton>
		</NcActions>
		<NcActions
			v-if="isText"
			forceMenu
			:aria-label="labels.align"
			:title="labels.align"
			variant="tertiary"
			data-test="toolbar-align"
			@close="emit('refocus')">
			<template #icon>
				<component :is="alignment.icon" :size="18" />
			</template>
			<NcActionButton
				v-for="entry in alignments"
				:key="entry.id"
				type="radio"
				closeAfterClick
				:modelValue="textStyle.align.value"
				:value="entry.id"
				:data-test="`toolbar-align-${entry.id}`"
				@click="textStyle.align.value = entry.id">
				<template #icon>
					<component :is="entry.icon" :size="20" />
				</template>
				{{ entry.label }}
			</NcActionButton>
		</NcActions>
		<TextEmphasisButtons v-if="isText" testPrefix="toolbar" :size="18" />
		<NcButton
			v-if="isText"
			data-test="toolbar-outline"
			:aria-label="labels.outline"
			:pressed="textStyle.outline.value"
			:title="labels.outline"
			variant="tertiary"
			@click="textStyle.outline.value = !textStyle.outline.value">
			<template #icon>
				<BorderOutside :size="18" />
			</template>
		</NcButton>
		<NcButton
			v-if="isText"
			data-test="toolbar-background"
			:aria-label="labels.background"
			:pressed="textStyle.background.value"
			:title="labels.background"
			variant="tertiary"
			@click="textStyle.background.value = !textStyle.background.value">
			<template #icon>
				<FormatColorHighlight :size="18" />
			</template>
		</NcButton>
		<template v-if="!typing">
			<NcButton
				data-test="duplicate"
				:aria-label="labels.duplicate"
				:title="labels.duplicate"
				variant="tertiary"
				@click="emit('duplicate')">
				<template #icon>
					<ContentCopy :size="18" />
				</template>
			</NcButton>
			<NcButton
				data-test="delete"
				:aria-label="labels.delete"
				:title="labels.delete"
				variant="tertiary"
				@click="emit('delete')">
				<template #icon>
					<Delete :size="18" />
				</template>
			</NcButton>
		</template>
	</GlassSurface>
</template>

<style scoped lang="scss">
.floating-toolbar {
	position: absolute;
	display: flex;
	align-items: center;
	gap: 2px;
	padding: 2px;
	transform: translateX(-50%);
	z-index: 1;

	// Sized like the buttons around it, showing the swatch as a disc
	&__color {
		display: flex;
		align-items: center;
		justify-content: center;
		inline-size: var(--default-clickable-area, 34px);
		block-size: var(--default-clickable-area, 34px);

		input {
			inline-size: 20px;
			block-size: 20px;
			padding: 0;
			border: none;
			border-radius: 50%;
			background: transparent;
			cursor: pointer;

			&::-webkit-color-swatch-wrapper {
				padding: 0;
			}

			&::-webkit-color-swatch {
				border: 1px solid rgba(255, 255, 255, 0.5);
				border-radius: 50%;
			}
		}
	}
}
</style>
