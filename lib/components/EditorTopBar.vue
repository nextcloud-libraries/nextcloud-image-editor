<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import NcButton from '@nextcloud/vue/components/NcButton'
import MagnifyMinusOutline from 'vue-material-design-icons/MagnifyMinusOutline.vue'
import MagnifyPlusOutline from 'vue-material-design-icons/MagnifyPlusOutline.vue'
import Redo from 'vue-material-design-icons/Redo.vue'
import Restore from 'vue-material-design-icons/Restore.vue'
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
	revert: []
}>()

const context = useEditorContext()

const labels = {
	undo: t('Undo'),
	redo: t('Redo'),
	revert: t('Revert all changes'),
	zoomIn: t('Zoom in'),
	zoomOut: t('Zoom out'),
	save: t('Save'),
	cancel: t('Cancel'),
}

/**
 * Step the view magnification, snapping back to the fitted view.
 *
 * @param direction 1 to zoom in, -1 to zoom out
 */
function stepZoom(direction: 1 | -1) {
	const factor = direction === 1 ? 1.5 : 1 / 1.5
	const next = context.viewZoom.value * factor
	context.viewZoom.value = next < 1.05 ? 1 : Math.min(4, next)
}
</script>

<template>
	<div class="editor-topbar">
		<div class="editor-topbar__start">
			<NcButton
				data-test="revert"
				:aria-label="labels.revert"
				:title="labels.revert"
				:disabled="!loaded || !context.canUndo.value"
				variant="tertiary"
				@click="emit('revert')">
				<template #icon>
					<Restore :size="20" />
				</template>
			</NcButton>
		</div>

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

			<span class="editor-topbar__separator" />

			<NcButton
				data-test="zoom-out"
				:aria-label="labels.zoomOut"
				:title="labels.zoomOut"
				:disabled="!loaded || context.viewZoom.value <= 1"
				variant="tertiary"
				@click="stepZoom(-1)">
				<template #icon>
					<MagnifyMinusOutline :size="20" />
				</template>
			</NcButton>
			<NcButton
				data-test="zoom-in"
				:aria-label="labels.zoomIn"
				:title="labels.zoomIn"
				:disabled="!loaded || context.viewZoom.value >= 4"
				variant="tertiary"
				@click="stepZoom(1)">
				<template #icon>
					<MagnifyPlusOutline :size="20" />
				</template>
			</NcButton>
		</div>

		<div class="editor-topbar__actions">
			<NcButton data-test="cancel" variant="tertiary" @click="emit('cancel')">
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
		align-items: center;
		gap: var(--default-grid-baseline);
		padding: 2px;
		border-radius: var(--border-radius-pill, 100px);
		background-color: var(--color-background-hover);
	}

	&__separator {
		width: 1px;
		height: 20px;
		background-color: var(--color-border);
	}

	// Both sides flex equally so the history pill stays centered
	&__start,
	&__actions {
		flex: 1;
		display: flex;
		gap: var(--default-grid-baseline);
	}

	&__actions {
		justify-content: flex-end;
	}
}
</style>
