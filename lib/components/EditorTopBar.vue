<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { showConfirmation } from '@nextcloud/dialogs'
import NcButton from '@nextcloud/vue/components/NcButton'
import Close from 'vue-material-design-icons/Close.vue'
import MagnifyMinusOutline from 'vue-material-design-icons/MagnifyMinusOutline.vue'
import MagnifyPlusOutline from 'vue-material-design-icons/MagnifyPlusOutline.vue'
import Redo from 'vue-material-design-icons/Redo.vue'
import Restore from 'vue-material-design-icons/Restore.vue'
import Undo from 'vue-material-design-icons/Undo.vue'
import { useEditorCommands } from '../editor/commands.ts'
import { useEditorContext } from '../editor/context.ts'
import { MAX_ZOOM, MIN_ZOOM } from '../editor/view.ts'
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
const commands = useEditorCommands()

const labels = {
	undo: t('Undo'),
	redo: t('Redo'),
	revert: t('Revert all changes'),
	revertText: t('All edits will be discarded. This cannot be undone by closing the dialog.'),
	zoomIn: t('Zoom in'),
	zoomOut: t('Zoom out'),
	resetZoom: t('Reset zoom'),
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
	context.setViewZoom(context.viewZoom.value * factor)
}

/**
 * Reset the view to the fitted state.
 */
function resetZoom() {
	context.setViewZoom(MIN_ZOOM)
}

/**
 * Confirm before discarding every edit. The shared dialog keeps this
 * consistent with the destructive confirmations the rest of Nextcloud
 * puts in front of the user.
 */
async function onRevert() {
	if (await showConfirmation({
		name: labels.revert,
		text: labels.revertText,
		labelConfirm: labels.revert,
		labelReject: labels.cancel,
		severity: 'warning',
	})) {
		commands.revert()
	}
}
</script>

<template>
	<div class="editor-topbar">
		<span class="editor-topbar__spacer" />

		<div class="editor-topbar__history">
			<NcButton
				data-test="revert"
				:aria-label="labels.revert"
				:title="labels.revert"
				:disabled="!loaded || !context.canUndo.value"
				variant="tertiary"
				@click="onRevert">
				<template #icon>
					<Restore :size="20" />
				</template>
			</NcButton>

			<span class="editor-topbar__separator" />

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
				:disabled="!loaded || context.viewZoom.value <= MIN_ZOOM"
				variant="tertiary"
				@click="stepZoom(-1)">
				<template #icon>
					<MagnifyMinusOutline :size="20" />
				</template>
			</NcButton>
			<button
				type="button"
				class="editor-topbar__zoom"
				data-test="zoom-reset"
				:aria-label="labels.resetZoom"
				:title="labels.resetZoom"
				:disabled="!loaded"
				@click="resetZoom">
				{{ Math.round(context.viewZoom.value * 100) }}%
			</button>
			<NcButton
				data-test="zoom-in"
				:aria-label="labels.zoomIn"
				:title="labels.zoomIn"
				:disabled="!loaded || context.viewZoom.value >= MAX_ZOOM"
				variant="tertiary"
				@click="stepZoom(1)">
				<template #icon>
					<MagnifyPlusOutline :size="20" />
				</template>
			</NcButton>
		</div>

		<div class="editor-topbar__actions">
			<NcButton
				data-test="cancel"
				class="editor-topbar__cancel-text"
				variant="tertiary"
				@click="emit('cancel')">
				{{ labels.cancel }}
			</NcButton>
			<NcButton
				data-test="cancel-icon"
				class="editor-topbar__cancel-icon"
				:aria-label="labels.cancel"
				:title="labels.cancel"
				variant="tertiary"
				@click="emit('cancel')">
				<template #icon>
					<Close :size="20" />
				</template>
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
	padding: calc(var(--default-grid-baseline) * 2) calc(var(--default-grid-baseline) * 6);

	&__history {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 2px;
		border-radius: var(--border-radius-pill, 100px);
		background: var(--editor-glass, rgba(22, 22, 26, 0.6));
		backdrop-filter: blur(24px) saturate(1.4);
		border: 1px solid rgba(255, 255, 255, 0.09);
	}

	&__separator {
		width: 1px;
		height: 20px;
		background-color: var(--color-border);
	}

	&__zoom {
		min-width: 48px;
		border: none;
		background: transparent;
		color: var(--color-main-text);
		font-size: 12px;
		font-variant-numeric: tabular-nums;
		opacity: 0.8;
		cursor: pointer;
		padding: 0 4px;

		&:hover:not(:disabled) {
			opacity: 1;
		}

		&:focus-visible {
			outline: 2px solid var(--color-primary-element);
			outline-offset: 2px;
		}

		&:disabled {
			cursor: default;
			opacity: 0.4;
		}
	}

	// Both sides flex equally so the history pill stays centered
	&__spacer,
	&__actions {
		flex: 1;
		display: flex;
		align-items: center;
		gap: var(--default-grid-baseline);
	}

	&__actions {
		justify-content: flex-end;
	}

	// Text cancel on wide layouts, icon-only on narrow ones
	&__cancel-icon {
		display: none !important;
	}

	@container editor (max-width: 600px) {
		padding-inline: calc(var(--default-grid-baseline) * 2);

		&__cancel-text {
			display: none !important;
		}

		&__cancel-icon {
			display: inline-flex !important;
		}

		&__zoom {
			min-width: 40px;
		}
	}
}
</style>
