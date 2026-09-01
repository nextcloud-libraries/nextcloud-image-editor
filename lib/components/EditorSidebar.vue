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
import IconTab from './base/IconTab.vue'
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
		<IconTab
			v-for="mode in modes"
			:key="mode.id"
			:label="mode.label"
			:active="context.activeMode.value === mode.id"
			:disabled="!loaded"
			@click="context.setMode(mode.id)">
			<component :is="mode.icon" :size="20" />
		</IconTab>
	</nav>
</template>

<style scoped lang="scss">
// Vertical labeled tool rail: icon above label, the active tab softly
// tinted by the image's ambient color (see IconTab)
.editor-sidebar {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: calc(var(--default-grid-baseline) * 2);
	padding: var(--default-grid-baseline);
}
</style>
