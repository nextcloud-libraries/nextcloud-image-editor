<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { FilterPreset } from '../../editor/state.ts'

import { shallowRef, watch } from 'vue'
import GlassSurface from '../base/GlassSurface.vue'
import PresetChip from '../base/PresetChip.vue'
import { useEditorContext } from '../../editor/context.ts'
import { presetThumbnail, thumbnailKey } from '../../editor/render.ts'
import { t } from '../../utils/l10n.ts'

const props = defineProps<{
	/** Whether an image is loaded and the tools are usable */
	loaded: boolean
	/** Orientation-baked source canvas, for the previews */
	oriented?: HTMLCanvasElement | null
}>()

const context = useEditorContext()

const presets: { id: FilterPreset, label: string }[] = [
	{ id: 'none', label: t('No filter') },
	{ id: 'pop', label: t('Pop') },
	{ id: 'golden', label: t('Golden') },
	{ id: 'coast', label: t('Coast') },
	{ id: 'cinema', label: t('Cinema') },
	{ id: 'berry', label: t('Berry') },
	{ id: 'mist', label: t('Mist') },
	{ id: 'warm', label: t('Warm') },
	{ id: 'cool', label: t('Cool') },
	{ id: 'fade', label: t('Fade') },
	{ id: 'grayscale', label: t('Grayscale') },
	{ id: 'noir', label: t('Noir') },
	{ id: 'luna', label: t('Luna') },
	{ id: 'sepia', label: t('Sepia') },
	{ id: 'invert', label: t('Invert') },
	{ id: 'solarize', label: t('Solarize') },
	{ id: 'posterize', label: t('Posterize') },
]

// Live preview chips: each preset applied to the current image.
// Redrawing all seventeen means seventeen filter passes and as many
// data URLs, so they are only redrawn when what they show changes,
// which is the image, the crop and the adjustments. Picking a preset
// or drawing an annotation leaves them alone.
const presetPreviews = shallowRef<{ id: FilterPreset, label: string, url: string }[]>([])

watch(
	[() => props.oriented, () => thumbnailKey(context.state.value)],
	([oriented]) => {
		presetPreviews.value = oriented
			? presets.map((preset) => ({
					...preset,
					url: presetThumbnail(oriented, context.state.value, preset.id),
				}))
			: []
	},
	{ immediate: true },
)

/**
 * Apply a filter preset.
 *
 * @param preset the preset to apply
 * @param label the preset's translated name, for the history list
 */
function setPreset(preset: FilterPreset, label: string) {
	context.commit({ ...context.state.value, preset }, label)
}
</script>

<template>
	<GlassSurface variant="strip" class="filter-strip">
		<PresetChip
			v-for="preset in presetPreviews"
			:key="preset.id"
			:url="preset.url"
			:label="preset.label"
			:active="context.state.value.preset === preset.id"
			:disabled="!loaded"
			:data-test="`preset-${preset.id}`"
			@click="setPreset(preset.id, preset.label)" />
	</GlassSurface>
</template>

<style scoped lang="scss">
.filter-strip {
	display: flex;
	flex-direction: column;
	gap: calc(var(--default-grid-baseline) * 2);
	padding: calc(var(--default-grid-baseline) * 2);
	overflow-y: auto;
	max-height: 100%;

	// Slim glass-fitting scrollbar
	scrollbar-width: thin;
	scrollbar-color: rgba(255, 255, 255, 0.25) transparent;

	&::-webkit-scrollbar {
		width: 6px;
		height: 6px;
	}

	&::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.22);
		border-radius: 3px;
	}

	&::-webkit-scrollbar-track {
		background: transparent;
	}
}
</style>
