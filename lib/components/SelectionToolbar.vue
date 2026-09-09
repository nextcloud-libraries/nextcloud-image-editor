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
import { useTextStyle } from '../composables/useTextStyle.ts'
import { useEditorContext } from '../editor/context.ts'
import { TEXT_ALIGNS, textAlign } from '../editor/text-align.ts'
import { t } from '../utils/l10n.ts'

defineProps<{
	/** Stage-space bounds of the selected annotation */
	box: { x: number, y: number, width: number, height: number }
}>()

const emit = defineEmits<{
	duplicate: []
	delete: []
}>()

const context = useEditorContext()
const textStyle = useTextStyle(context)

// The styling switches belong here as well as in the annotate panel:
// selecting a caption means leaving the text tool, and this is the only
// chrome that follows a selection around
const isText = computed(() => context.state.value.annotations
	.some((entry) => entry.id === context.selectedId.value && entry.type === 'text'))

const duplicateLabel = t('Duplicate')
const deleteLabel = t('Delete')
const outlineLabel = t('Outline')
const backgroundLabel = t('Background')
const fontLabel = t('Font')
const alignLabel = t('Alignment')

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
	<GlassSurface
		variant="pill"
		class="selection-toolbar"
		data-test="selection-toolbar"
		:style="{
			insetInlineStart: `${box.x + box.width / 2}px`,
			// Above the selection as designed, clearing the rotate handle;
			// below only when the top edge would clip it
			insetBlockStart: box.y - 76 >= 4
				? `${box.y - 76}px`
				: `${box.y + box.height + 12}px`,
		}">
		<NcActions
			v-if="isText"
			forceMenu
			:aria-label="fontLabel"
			:title="fontLabel"
			variant="tertiary"
			data-test="selection-font">
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
				:data-test="`selection-font-${entry.id}`"
				@click="textStyle.font.value = entry.id">
				{{ entry.label }}
			</NcActionButton>
		</NcActions>
		<NcActions
			v-if="isText"
			forceMenu
			:aria-label="alignLabel"
			:title="alignLabel"
			variant="tertiary"
			data-test="selection-align">
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
				:data-test="`selection-align-${entry.id}`"
				@click="textStyle.align.value = entry.id">
				<template #icon>
					<component :is="entry.icon" :size="20" />
				</template>
				{{ entry.label }}
			</NcActionButton>
		</NcActions>
		<TextEmphasisButtons v-if="isText" testPrefix="selection" :size="18" />
		<NcButton
			v-if="isText"
			data-test="selection-outline"
			:aria-label="outlineLabel"
			:aria-pressed="textStyle.outline.value"
			:title="outlineLabel"
			variant="tertiary"
			@click="textStyle.outline.value = !textStyle.outline.value">
			<template #icon>
				<BorderOutside :size="18" />
			</template>
		</NcButton>
		<NcButton
			v-if="isText"
			data-test="selection-background"
			:aria-label="backgroundLabel"
			:aria-pressed="textStyle.background.value"
			:title="backgroundLabel"
			variant="tertiary"
			@click="textStyle.background.value = !textStyle.background.value">
			<template #icon>
				<FormatColorHighlight :size="18" />
			</template>
		</NcButton>
		<NcButton
			data-test="duplicate"
			:aria-label="duplicateLabel"
			:title="duplicateLabel"
			variant="tertiary"
			@click="emit('duplicate')">
			<template #icon>
				<ContentCopy :size="18" />
			</template>
		</NcButton>
		<NcButton
			data-test="delete"
			:aria-label="deleteLabel"
			:title="deleteLabel"
			variant="tertiary"
			@click="emit('delete')">
			<template #icon>
				<Delete :size="18" />
			</template>
		</NcButton>
	</GlassSurface>
</template>

<style scoped>
.selection-toolbar {
	position: absolute;
	display: flex;
	gap: 2px;
	padding: 2px;
	transform: translateX(-50%);
	z-index: 1;
}
</style>
