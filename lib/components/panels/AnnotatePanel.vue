<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Tool } from '../../editor/context.ts'

import { computed } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import ArrowTopRight from 'vue-material-design-icons/ArrowTopRight.vue'
import EllipseOutline from 'vue-material-design-icons/EllipseOutline.vue'
import FormatText from 'vue-material-design-icons/FormatText.vue'
import Pencil from 'vue-material-design-icons/Pencil.vue'
import RectangleOutline from 'vue-material-design-icons/RectangleOutline.vue'
import EditorSlider from '../base/EditorSlider.vue'
import { useEditorContext } from '../../editor/context.ts'
import { t } from '../../utils/l10n.ts'

defineProps<{
	/** Whether an image is loaded and the tools are usable */
	loaded: boolean
}>()

const context = useEditorContext()

const labels = {
	color: t('Color'),
	strokeWidth: t('Stroke width'),
	fontSize: t('Font size'),
}

const subTools: { id: Tool, label: string, icon: unknown }[] = [
	{ id: 'draw', label: t('Draw'), icon: Pencil },
	{ id: 'rectangle', label: t('Rectangle'), icon: RectangleOutline },
	{ id: 'ellipse', label: t('Ellipse'), icon: EllipseOutline },
	{ id: 'arrow', label: t('Arrow'), icon: ArrowTopRight },
	{ id: 'text', label: t('Text'), icon: FormatText },
]

const showStrokeOptions = computed(() => ['draw', 'rectangle', 'ellipse', 'arrow'].includes(context.activeTool.value))
</script>

<template>
	<div class="annotate-panel">
		<div class="annotate-panel__row">
			<NcButton
				v-for="tool in subTools"
				:key="tool.id"
				:aria-label="tool.label"
				:title="tool.label"
				:disabled="!loaded"
				:pressed="context.activeTool.value === tool.id"
				variant="tertiary"
				@click="context.activeTool.value = tool.id">
				<template #icon>
					<component :is="tool.icon" :size="20" />
				</template>
			</NcButton>

			<span class="annotate-panel__divider" />

			<label class="annotate-panel__option">
				{{ labels.color }}
				<!-- Native input: @nextcloud/vue offers no compact color field -->
				<input v-model="context.drawColor.value" type="color">
			</label>
		</div>
		<EditorSlider
			v-if="showStrokeOptions"
			:value="context.strokeWidth.value"
			:min="1"
			:max="32"
			:step="1"
			:aria-label="labels.strokeWidth"
			@input="context.strokeWidth.value = $event"
			@commit="() => {}" />
		<EditorSlider
			v-else-if="context.activeTool.value === 'text'"
			:value="context.fontSize.value"
			:min="8"
			:max="128"
			:step="1"
			:aria-label="labels.fontSize"
			@input="context.fontSize.value = $event"
			@commit="() => {}" />
	</div>
</template>

<style scoped lang="scss">
.annotate-panel {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: calc(var(--default-grid-baseline) * 2);
	width: 100%;

	&__row {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		gap: calc(var(--default-grid-baseline) * 2);
	}

	&__divider {
		width: 1px;
		height: 24px;
		background-color: rgba(255, 255, 255, 0.12);
	}

	&__option {
		display: flex;
		align-items: center;
		gap: var(--default-grid-baseline);
		font-size: 12px;
		opacity: 0.9;
	}
}
</style>
