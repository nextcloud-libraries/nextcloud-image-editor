<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { EditorMode } from '../editor/context.ts'

import Crop from 'vue-material-design-icons/Crop.vue'
import PaletteOutline from 'vue-material-design-icons/PaletteOutline.vue'
import Pencil from 'vue-material-design-icons/Pencil.vue'
import StickerEmoji from 'vue-material-design-icons/StickerEmoji.vue'
import Tune from 'vue-material-design-icons/Tune.vue'
import { useEditorContext } from '../editor/context.ts'
import { t } from '../utils/l10n.ts'

defineProps<{
	/** Whether an image is loaded and the tools are usable */
	loaded: boolean
}>()

const context = useEditorContext()

const modes: { id: EditorMode, label: string, icon: unknown }[] = [
	{ id: 'crop', label: t('Crop'), icon: Crop },
	{ id: 'finetune', label: t('Finetune'), icon: Tune },
	{ id: 'filter', label: t('Filter'), icon: PaletteOutline },
	{ id: 'annotate', label: t('Annotate'), icon: Pencil },
	{ id: 'sticker', label: t('Sticker'), icon: StickerEmoji },
]
</script>

<template>
	<nav class="editor-sidebar">
		<button
			v-for="mode in modes"
			:key="mode.id"
			type="button"
			class="editor-sidebar__tab"
			:class="{ 'editor-sidebar__tab--active': context.activeMode.value === mode.id }"
			:disabled="!loaded"
			:aria-pressed="context.activeMode.value === mode.id"
			@click="context.setMode(mode.id)">
			<component :is="mode.icon" :size="20" />
			<span>{{ mode.label }}</span>
		</button>
	</nav>
</template>

<style scoped lang="scss">
.editor-sidebar {
	display: flex;
	flex-direction: column;
	gap: calc(var(--default-grid-baseline) * 2);
	padding: calc(var(--default-grid-baseline) * 2);
	overflow-y: auto;

	&__tab {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		width: 64px;
		padding: calc(var(--default-grid-baseline) * 2) var(--default-grid-baseline);
		border: none;
		border-radius: var(--border-radius-large, 10px);
		background: transparent;
		color: var(--color-main-text);
		font-size: 12px;
		cursor: pointer;
		transition: background-color 0.15s ease, box-shadow 0.15s ease;

		&:hover:not(:disabled) {
			background-color: var(--color-background-hover);
		}

		&:focus-visible {
			outline: 2px solid var(--color-primary-element);
			outline-offset: 2px;
		}

		&--active {
			background-color: var(--color-background-dark);
			box-shadow: inset 0 0 0 1px var(--color-border);
		}

		&:disabled {
			opacity: 0.5;
			cursor: default;
		}
	}
}
</style>
