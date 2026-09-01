<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import NcButton from '@nextcloud/vue/components/NcButton'
import Redo from 'vue-material-design-icons/Redo.vue'
import Undo from 'vue-material-design-icons/Undo.vue'
import { useEditorContext } from '../editor/context.ts'
import { t } from '../utils/l10n.ts'

defineProps<{
	/** Whether an image is loaded and the tools are usable */
	loaded: boolean
}>()

const emit = defineEmits<{
	save: []
	cancel: []
}>()

const context = useEditorContext()

const labels = {
	undo: t('Undo'),
	redo: t('Redo'),
	save: t('Save'),
	cancel: t('Cancel'),
}
</script>

<template>
	<div class="editor-topbar">
		<NcButton data-test="cancel" variant="tertiary" @click="emit('cancel')">
			{{ labels.cancel }}
		</NcButton>

		<div class="editor-topbar__history">
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
		</div>

		<NcButton
			data-test="save"
			variant="primary"
			:disabled="!loaded"
			@click="emit('save')">
			{{ labels.save }}
		</NcButton>
	</div>
</template>

<style scoped lang="scss">
.editor-topbar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: var(--default-grid-baseline) calc(var(--default-grid-baseline) * 2);

	&__history {
		display: flex;
		gap: var(--default-grid-baseline);
		padding: 2px;
		border-radius: var(--border-radius-pill, 100px);
		background-color: var(--color-background-hover);
	}
}
</style>
