<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { computed } from 'vue'
import { useEditorContext } from '../../editor/context.ts'
import { t } from '../../utils/l10n.ts'

const context = useEditorContext()

const hint = t('Click an annotation to move, resize or recolor it')
const transformHint = t('Drag to move, use the handles to resize')

const selected = computed(() => context.selectedId.value !== null)
</script>

<template>
	<div class="select-panel">
		<span class="select-panel__hint">{{ selected ? transformHint : hint }}</span>
	</div>
</template>

<style scoped lang="scss">
.select-panel {
	display: flex;
	align-items: center;
	justify-content: center;

	&__hint {
		font-size: 12px;
		opacity: 0.65;
	}
}
</style>
