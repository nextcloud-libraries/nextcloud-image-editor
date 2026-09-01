<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import NcButton from '@nextcloud/vue/components/NcButton'
import ContentCopy from 'vue-material-design-icons/ContentCopy.vue'
import Delete from 'vue-material-design-icons/Delete.vue'
import GlassSurface from './base/GlassSurface.vue'
import { t } from '../utils/l10n.ts'

defineProps<{
	/** Stage-space bounds of the selected annotation */
	box: { x: number, y: number, width: number, height: number }
}>()

const emit = defineEmits<{
	duplicate: []
	delete: []
}>()

const duplicateLabel = t('Duplicate')
const deleteLabel = t('Delete')
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
