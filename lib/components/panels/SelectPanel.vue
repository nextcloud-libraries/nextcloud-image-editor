<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { useEditorContext } from '../../editor/context.ts'
import { t } from '../../utils/l10n.ts'

defineProps<{
	/** Whether an image is loaded and the tools are usable */
	loaded: boolean
}>()

const context = useEditorContext()

const colorLabel = t('Color')
const hint = t('Click an annotation to move, resize or recolor it')
</script>

<template>
	<div class="select-panel">
		<label v-if="context.selectedId.value !== null" class="select-panel__option">
			{{ colorLabel }}
			<!-- Native input: @nextcloud/vue offers no compact color field -->
			<input v-model="context.drawColor.value" type="color" :disabled="!loaded">
		</label>
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
