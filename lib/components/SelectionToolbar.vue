<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { computed } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import BorderOutside from 'vue-material-design-icons/BorderOutside.vue'
import ContentCopy from 'vue-material-design-icons/ContentCopy.vue'
import Delete from 'vue-material-design-icons/Delete.vue'
import FormatColorHighlight from 'vue-material-design-icons/FormatColorHighlight.vue'
import GlassSurface from './base/GlassSurface.vue'
import { useTextStyle } from '../composables/useTextStyle.ts'
import { useEditorContext } from '../editor/context.ts'
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
