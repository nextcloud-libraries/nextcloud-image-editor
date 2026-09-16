<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import EllipseOutline from 'vue-material-design-icons/EllipseOutline.vue'
import RectangleOutline from 'vue-material-design-icons/RectangleOutline.vue'
import IconTab from '../base/IconTab.vue'
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
	rectangle: t('Rectangular area'),
	ellipse: t('Oval area'),
}
</script>

<template>
	<div class="redact-panel">
		<IconTab
			data-test="redact-pixelate"
			:label="labels.pixelate"
			:active="context.redactStyle.value === 'pixelate'"
			:disabled="!loaded"
			@click="context.redactStyle.value = 'pixelate'" />
		<IconTab
			data-test="redact-blur"
			:label="labels.blur"
			:active="context.redactStyle.value === 'blur'"
			:disabled="!loaded"
			@click="context.redactStyle.value = 'blur'" />
		<span class="redact-panel__divider" />
		<IconTab
			data-test="redact-rectangle"
			:label="labels.rectangle"
			:active="context.redactShape.value === 'rectangle'"
			:disabled="!loaded"
			iconOnly
			@click="context.redactShape.value = 'rectangle'">
			<RectangleOutline :size="20" />
		</IconTab>
		<IconTab
			data-test="redact-ellipse"
			:label="labels.ellipse"
			:active="context.redactShape.value === 'ellipse'"
			:disabled="!loaded"
			iconOnly
			@click="context.redactShape.value = 'ellipse'">
			<EllipseOutline :size="20" />
		</IconTab>
	</div>
</template>

<style scoped lang="scss">
.redact-panel {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: calc(var(--default-grid-baseline) * 2);
}

.redact-panel__divider {
	inline-size: 1px;
	block-size: 24px;
	background: var(--color-border);
}
</style>
