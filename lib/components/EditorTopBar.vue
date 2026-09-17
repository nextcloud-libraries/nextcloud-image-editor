<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { showConfirmation } from '@nextcloud/dialogs'
import { computed, shallowRef } from 'vue'
import NcActionButton from '@nextcloud/vue/components/NcActionButton'
import NcActions from '@nextcloud/vue/components/NcActions'
import NcActionSeparator from '@nextcloud/vue/components/NcActionSeparator'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcDialog from '@nextcloud/vue/components/NcDialog'
import NcLoadingIcon from '@nextcloud/vue/components/NcLoadingIcon'
import NcNoteCard from '@nextcloud/vue/components/NcNoteCard'
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
import { FIT_ZOOM, MAX_ZOOM, MIN_ZOOM } from '../editor/view.ts'
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
 * Reset the view: the fitted zoom, centred. The picture can be slid
 * around at any zoom, so putting it back is part of the same button.
 */
function resetZoom() {
	context.setViewZoom(FIT_ZOOM)
	context.setViewPan({ x: 0, y: 0 })
}

/** Whether the editor is asking what to do with unsaved edits */
const closing = shallowRef(false)

/**
 * Leave the editor, asking what to do with the edits first where there
 * are any.
 */
function onClose() {
	if (isPristine(context.state.value)) {
		emit('cancel')
		return
	}
	closing.value = true
}

/**
 * Answer the closing dialog.
 *
 * @param answer what to do with the edits
 */
function onCloseAnswer(answer: 'stay' | 'discard' | 'save') {
	closing.value = false
	if (answer === 'save') {
		emit('save')
	} else if (answer === 'discard') {
		emit('cancel')
	}
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
			<!-- Undo and redo side by side, the pair they are, with the
			     list of steps beside them rather than between them -->
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

		<!-- Every way out of the editor is a button of the dialog, so it
		     has no close of its own -->
		<NcDialog
			v-if="closing"
			:name="labels.unsaved"
			noClose
			data-test="closing-dialog"
			@update:open="onCloseAnswer('stay')">
			<NcNoteCard type="warning" :text="labels.unsavedText" />
			<template #actions>
				<NcButton
					class="editor-topbar__stay"
					data-test="closing-cancel"
					variant="tertiary"
					@click="onCloseAnswer('stay')">
					{{ labels.cancel }}
				</NcButton>
				<NcButton
					data-test="closing-discard"
					variant="error"
					@click="onCloseAnswer('discard')">
					{{ labels.discard }}
				</NcButton>
				<NcButton
					data-test="closing-save"
					variant="primary"
					@click="onCloseAnswer('save')">
					{{ labels.save }}
				</NcButton>
			</template>
		</NcDialog>
	</div>
</template>

<style scoped lang="scss">
// The dialog renders in the body, away from the bar: staying sits apart
// from the two answers that leave
.editor-topbar__stay {
	margin-inline-end: auto;
}

.editor-topbar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	// The editor usually opens inside the viewer's modal, whose header is
	// this tall and whose close button sits centred in a margin of half
	// the space left beside it. Same geometry here, so the close button
	// does not jump when the editor opens over the viewer. Where the
	// pointer target is as tall as that header, which is what a phone
	// asks for, the bar grows rather than letting the buttons touch the
	// top edge.
	block-size: max(
		var(--header-height, 50px),
		calc(var(--default-clickable-area) + var(--default-grid-baseline) * 2)
	);
	// Between the history pill and the save button, which sit against
	// each other once the bar runs out of free space
	gap: calc(var(--default-grid-baseline) * 2);
	padding-block: 0;
	padding-inline: calc(var(--default-grid-baseline) * 6) var(--editor-header-margin);

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
		padding-inline: calc(var(--default-grid-baseline) * 2) var(--editor-header-margin);

		&__zoom {
			min-width: 34px;
		}

		// Centring the pill wastes the width a phone does not have: it
		// starts at the leading edge here, and the actions keep the other
		&__spacer {
			display: none;
		}

		&__actions {
			flex: none;
		}

		// Seven controls, a save button and a close button are more than
		// a phone is wide. The pill gives up the space between and around
		// them first, and scrolls sideways on the narrowest screens
		// rather than dropping a control or letting one fall off the edge.
		&__history {
			min-width: 0;
			gap: 0;
			padding: 0;
			overflow-x: auto;
			scrollbar-width: none;

			&::-webkit-scrollbar {
				display: none;
			}
		}
	}
}
</style>
