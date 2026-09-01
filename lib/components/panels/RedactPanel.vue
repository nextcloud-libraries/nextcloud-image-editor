<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import NcButton from '@nextcloud/vue/components/NcButton'
import { useEditorContext } from '../../editor/context.ts'
import { t } from '../../utils/l10n.ts'

defineProps<{
	/** Whether an image is loaded and the tools are usable */
	loaded: boolean
}>()

const context = useEditorContext()

const labels = {
	pixelate: t('Pixelate'),
	blur: t('Blur'),
}
</script>

<template>
	<div class="redact-panel">
		<NcButton
			data-test="redact-pixelate"
			:pressed="context.redactStyle.value === 'pixelate'"
			:disabled="!loaded"
			variant="tertiary"
			@click="context.redactStyle.value = 'pixelate'">
			{{ labels.pixelate }}
		</NcButton>
		<NcButton
			data-test="redact-blur"
			:pressed="context.redactStyle.value === 'blur'"
			:disabled="!loaded"
			variant="tertiary"
			@click="context.redactStyle.value = 'blur'">
			{{ labels.blur }}
		</NcButton>
	</div>
</template>

<style scoped lang="scss">
.redact-panel {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: calc(var(--default-grid-baseline) * 2);
}
</style>
