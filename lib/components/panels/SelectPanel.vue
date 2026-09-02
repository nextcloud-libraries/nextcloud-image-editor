<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { computed } from 'vue'
import { useAnnotationColor } from '../../composables/useAnnotationColor.ts'
import { useEditorContext } from '../../editor/context.ts'
import { t } from '../../utils/l10n.ts'

defineProps<{
	/** Whether an image is loaded and the tools are usable */
	loaded: boolean
}>()

const context = useEditorContext()
const color = useAnnotationColor(context)

const colorLabel = t('Color')
const hint = t('Click an annotation to move, resize or recolor it')
const transformHint = t('Drag to move, use the handles to resize')

const selectedAnnotation = computed(() => context.state.value.annotations
	.find((annotation) => annotation.id === context.selectedId.value) ?? null)

// Stickers render the emoji glyph and redactions destroy pixels:
// neither has a visible color, so the picker would mislead
const recolorable = computed(() => selectedAnnotation.value !== null
	&& selectedAnnotation.value.type !== 'sticker'
	&& selectedAnnotation.value.type !== 'redact')
</script>

<template>
	<div class="select-panel">
		<label v-if="recolorable" class="select-panel__option">
			{{ colorLabel }}
			<!-- Native input: @nextcloud/vue offers no compact color field -->
			<input
				:value="context.drawColor.value"
				type="color"
				:disabled="!loaded"
				data-test="color"
				@input="color.preview(($event.target as HTMLInputElement).value)"
				@change="color.commit(($event.target as HTMLInputElement).value)">
		</label>
		<span v-else-if="selectedAnnotation !== null" class="select-panel__hint">{{ transformHint }}</span>
		<span v-else class="select-panel__hint">{{ hint }}</span>
	</div>
</template>

<style scoped lang="scss">
.select-panel {
	display: flex;
	align-items: center;
	justify-content: center;

	&__option {
		display: flex;
		align-items: center;
		gap: var(--default-grid-baseline);
		font-size: 12px;
		opacity: 0.9;
	}

	&__hint {
		font-size: 12px;
		opacity: 0.65;
	}
}
</style>
