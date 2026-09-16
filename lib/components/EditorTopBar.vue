<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { getDialogBuilder, showConfirmation } from '@nextcloud/dialogs'
import { computed } from 'vue'
import NcActionButton from '@nextcloud/vue/components/NcActionButton'
import NcActions from '@nextcloud/vue/components/NcActions'
import NcActionSeparator from '@nextcloud/vue/components/NcActionSeparator'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcLoadingIcon from '@nextcloud/vue/components/NcLoadingIcon'
import Close from 'vue-material-design-icons/Close.vue'
import History from 'vue-material-design-icons/History.vue'
import MagnifyMinusOutline from 'vue-material-design-icons/MagnifyMinusOutline.vue'
import MagnifyPlusOutline from 'vue-material-design-icons/MagnifyPlusOutline.vue'
import Redo from 'vue-material-design-icons/Redo.vue'
import Restore from 'vue-material-design-icons/Restore.vue'
import Undo from 'vue-material-design-icons/Undo.vue'
import { useEditorCommands } from '../editor/commands.ts'
import { useEditorContext } from '../editor/context.ts'
import { historyIcon } from '../editor/history-icons.ts'
import { isPristine } from '../editor/state.ts'
import { MAX_ZOOM, MIN_ZOOM } from '../editor/view.ts'
import { t } from '../utils/l10n.ts'

defineProps<{
	/** Whether an image is loaded and the tools are usable */
	loaded: boolean
	/** Whether an export, or the host's own save, is in progress */
	saving?: boolean
	/**
	 * Where the history menu renders. It defaults to the body, which puts it
	 * outside the editor and out of reach of the styles that make it a menu
	 * rather than a bulleted list.
	 */
	popoverContainer?: HTMLElement | null
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
	revertText: t('All edits will be discarded. This action cannot be undone.'),
	zoomIn: t('Zoom in'),
	zoomOut: t('Zoom out'),
	resetZoom: t('Reset zoom'),
	save: t('Save'),
	cancel: t('Cancel'),
	close: t('Close the editor'),
	unsaved: t('Save your edits before closing?'),
	unsavedText: t('The image has edits that were never saved.'),
	discard: t('Discard changes'),
	history: t('Edit history'),
	step: t('Edit'),
}

// Newest first, which is the order the user thinks in when going back
const historySteps = computed(() => context.historyEntries.value
	.map((entry, index) => ({
		index,
		label: entry.label ?? labels.step,
		icon: historyIcon(entry.label ?? labels.step),
	}))
	.reverse())

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
 * Leave the editor, asking what to do with the edits first where there
 * are any. The dialog is dismissable, which is the third answer: stay.
 */
async function onClose() {
	if (isPristine(context.state.value)) {
		emit('cancel')
		return
	}
	const dialog = getDialogBuilder(labels.unsaved)
		.setText(labels.unsavedText)
		.setSeverity('warning')
		.addButton({ label: labels.cancel, callback: () => {} })
		.addButton({ label: labels.discard, variant: 'error', callback: () => emit('cancel') })
		.addButton({ label: labels.save, variant: 'primary', callback: () => emit('save') })
		.build()
	// Closing the dialog rejects it, and staying in the editor is what
	// closing it means
	await dialog.show().catch(() => {})
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
				data-test="undo"
				:aria-label="labels.undo"
				:title="labels.undo"
				:disabled="!loaded || !context.canUndo.value"
				variant="tertiary"
				@click="context.undo()">
				<template #icon>
					<Undo :size="20" />
				</template>
			</NcButton>
			<!-- `forceMenu` keeps the trigger a trigger even when the original
			     is the only entry. -->
			<NcActions
				forceMenu
				:container="popoverContainer ?? 'body'"
				:aria-label="labels.history"
				:title="labels.history"
				:disabled="!loaded || !context.canUndo.value"
				variant="tertiary"
				data-test="history">
				<template #icon>
					<History :size="20" />
				</template>
				<!-- Leaving the whole edit behind belongs with the steps it
				     throws away, above them, where the list is read from. -->
				<NcActionButton
					data-test="revert"
					@click="onRevert">
					<template #icon>
						<Restore :size="20" />
					</template>
					{{ labels.revert }}
				</NcActionButton>
				<NcActionSeparator />
				<!-- A radio rather than a plain entry: which step the image is on
				     is state, and `aria-current` would land on the presentational
				     list item where nothing reads it. -->
				<NcActionButton
					v-for="step in historySteps"
					:key="step.index"
					type="radio"
					:modelValue="String(context.historyIndex.value)"
					:value="String(step.index)"
					:data-test="`history-step-${step.index}`"
					@click="context.jumpTo(step.index)">
					<template #icon>
						<component :is="step.icon" :size="20" />
					</template>
					{{ step.label }}
				</NcActionButton>
			</NcActions>
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
				data-test="save"
				variant="primary"
				:disabled="!loaded || saving"
				@click="emit('save')">
				<!-- Rendering at natural resolution and encoding takes
					long enough on a photo to need saying, and the host's
					upload afterwards takes longer still -->
				<template v-if="saving" #icon>
					<NcLoadingIcon :size="20" data-test="saving" />
				</template>
				{{ labels.save }}
			</NcButton>
			<NcButton
				data-test="cancel"
				:aria-label="labels.close"
				:title="labels.close"
				variant="tertiary"
				@click="onClose">
				<template #icon>
					<Close :size="20" />
				</template>
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
		background: var(--editor-glass);
		backdrop-filter: blur(24px) saturate(1.4);
		border: 1px solid var(--color-border);
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
		color: var(--color-text-maxcontrast);
		// A button does not inherit the page font, it gets the browser's own
		font: inherit;
		font-variant-numeric: tabular-nums;
		cursor: pointer;
		padding: 0 4px;

		&:hover:not(:disabled) {
			color: var(--color-main-text);
		}

		&:focus-visible {
			outline: 2px solid var(--color-main-text);
			box-shadow: 0 0 0 4px var(--color-main-background);
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

	@container editor (max-width: 600px) {
		padding-inline: calc(var(--default-grid-baseline) * 2);

		&__zoom {
			min-width: 40px;
		}
	}
}
</style>
