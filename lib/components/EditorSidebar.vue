<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { EditorMode } from '../editor/context.ts'

import Blur from 'vue-material-design-icons/Blur.vue'
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
	{ id: 'finetune', label: t('Adjust'), icon: Tune },
	{ id: 'filter', label: t('Filter'), icon: PaletteOutline },
	{ id: 'annotate', label: t('Annotate'), icon: Pencil },
	{ id: 'sticker', label: t('Sticker'), icon: StickerEmoji },
	{ id: 'redact', label: t('Redact'), icon: Blur },
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
	// Vertical labeled tool rail, reference style: icon above label,
	// the active tab softly tinted by the image's ambient color
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: calc(var(--default-grid-baseline) * 2);
	padding: var(--default-grid-baseline);

	&__tab {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		width: 64px;
		padding: calc(var(--default-grid-baseline) * 2) var(--default-grid-baseline);
		border: none;
		border-radius: var(--border-radius-large, 12px);
		background: transparent;
		color: rgba(242, 242, 247, 0.75);
		font-size: 11px;
		letter-spacing: 0.01em;
		cursor: pointer;
		transition: background-color 0.12s ease, color 0.12s ease, transform 0.12s ease;

		&:active:not(:disabled) {
			transform: scale(0.96);
		}

		&:hover:not(:disabled) {
			background-color: rgba(255, 255, 255, 0.07);
			color: var(--color-main-text);
		}

		&:focus-visible {
			outline: 2px solid var(--color-primary-element);
			outline-offset: 2px;
		}

		&--active {
			background: rgba(var(--editor-ambient, 88, 86, 112), 0.3);
			color: var(--color-main-text);
			box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12), 0 4px 16px rgba(0, 0, 0, 0.3);
			backdrop-filter: blur(12px);
		}

		&:disabled {
			opacity: 0.5;
			cursor: default;
		}
	}
}
</style>
