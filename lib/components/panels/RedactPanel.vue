<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import NcButton from '@nextcloud/vue/components/NcButton'
import EllipseOutline from 'vue-material-design-icons/EllipseOutline.vue'
import RectangleOutline from 'vue-material-design-icons/RectangleOutline.vue'
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
		<span class="redact-panel__divider" />
		<NcButton
			data-test="redact-rectangle"
			:aria-label="labels.rectangle"
			:title="labels.rectangle"
			:pressed="context.redactShape.value === 'rectangle'"
			:disabled="!loaded"
			variant="tertiary"
			@click="context.redactShape.value = 'rectangle'">
			<template #icon>
				<RectangleOutline :size="20" />
			</template>
		</NcButton>
		<NcButton
			data-test="redact-ellipse"
			:aria-label="labels.ellipse"
			:title="labels.ellipse"
			:pressed="context.redactShape.value === 'ellipse'"
			:disabled="!loaded"
			variant="tertiary"
			@click="context.redactShape.value = 'ellipse'">
			<template #icon>
				<EllipseOutline :size="20" />
			</template>
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

.redact-panel__divider {
	inline-size: 1px;
	block-size: 24px;
	background: var(--color-border);
}
</style>
