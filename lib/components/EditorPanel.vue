<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import GlassSurface from './base/GlassSurface.vue'
import AdjustPanel from './panels/AdjustPanel.vue'
import AnnotatePanel from './panels/AnnotatePanel.vue'
import CropPanel from './panels/CropPanel.vue'
import FilterStrip from './panels/FilterStrip.vue'
import RedactPanel from './panels/RedactPanel.vue'
import SelectPanel from './panels/SelectPanel.vue'
import StickerPanel from './panels/StickerPanel.vue'
import { useEditorContext } from '../editor/context.ts'

defineProps<{
	/** Whether an image is loaded and the tools are usable */
	loaded: boolean
	/** Orientation-baked source canvas, for the filter previews */
	oriented?: HTMLCanvasElement | null
}>()

const context = useEditorContext()
</script>

<template>
	<!-- Filter mode gets a vertical preview strip, everything else the
		bottom control card; each mode's controls live in its own panel -->
	<FilterStrip
		v-if="context.activeMode.value === 'filter'"
		:loaded="loaded"
		:oriented="oriented" />

	<GlassSurface v-else variant="card" class="editor-card">
		<CropPanel v-if="context.activeMode.value === 'crop'" :loaded="loaded" />
		<AdjustPanel v-else-if="context.activeMode.value === 'finetune'" :loaded="loaded" />
		<AnnotatePanel v-else-if="context.activeMode.value === 'annotate'" :loaded="loaded" />
		<SelectPanel v-else-if="context.activeMode.value === 'select'" :loaded="loaded" />
		<StickerPanel v-else-if="context.activeMode.value === 'sticker'" :loaded="loaded" />
		<RedactPanel v-else-if="context.activeMode.value === 'redact'" :loaded="loaded" />
	</GlassSurface>
</template>

<style scoped lang="scss">
.editor-card {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: calc(var(--default-grid-baseline) * 2);
	min-width: min(420px, 92cqw);
	max-width: min(680px, 94cqw);
	padding: calc(var(--default-grid-baseline) * 3) calc(var(--default-grid-baseline) * 5);

	@container editor (max-width: 600px) {
		min-width: 0;
		width: 100%;
		max-width: none;
		padding-inline: calc(var(--default-grid-baseline) * 3);
	}
}
</style>
