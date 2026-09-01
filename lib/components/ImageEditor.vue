<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { ExportOptions, ExportResult } from '../types/index.ts'
import type { FitResult } from '../utils/geometry.ts'

import Konva from 'konva'
import { onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import { fitContain } from '../utils/geometry.ts'
import { canvasToBlob, loadImage } from '../utils/image.ts'
import { t } from '../utils/l10n.ts'

const props = defineProps<{
	/** Image to edit: Blob, File or URL */
	src: Blob | string
	/** Accessible label of the canvas area */
	label?: string
}>()

const emit = defineEmits<{
	save: [result: ExportResult]
	cancel: []
	error: [error: Error]
}>()

const canvasLabel = t('Image editor')

const container = useTemplateRef<HTMLDivElement>('container')
const loaded = ref(false)

// Konva objects are deliberately non-reactive: proxying them breaks
// their internal caching and costs performance for no benefit.
let stage: Konva.Stage | null = null
let imageNode: Konva.Image | null = null
let sourceImage: HTMLImageElement | null = null
let fit: FitResult | null = null
let resizeObserver: ResizeObserver | null = null

/**
 * Scale and center the image inside the current container bounds.
 */
function refit(): void {
	if (stage === null || imageNode === null || sourceImage === null || container.value === null) {
		return
	}
	const { clientWidth, clientHeight } = container.value
	if (clientWidth === 0 || clientHeight === 0) {
		return
	}

	stage.size({ width: clientWidth, height: clientHeight })
	fit = fitContain(
		{ width: sourceImage.naturalWidth, height: sourceImage.naturalHeight },
		{ width: clientWidth, height: clientHeight },
	)
	imageNode.setAttrs({
		x: fit.x,
		y: fit.y,
		scaleX: fit.scale,
		scaleY: fit.scale,
	})
}

/**
 * Load the source image and (re)build the stage content.
 */
async function load(): Promise<void> {
	loaded.value = false
	try {
		sourceImage = await loadImage(props.src)

		stage ??= new Konva.Stage({
			container: container.value!,
			width: container.value!.clientWidth,
			height: container.value!.clientHeight,
		})
		stage.destroyChildren()

		imageNode = new Konva.Image({ image: sourceImage, listening: false })
		const layer = new Konva.Layer()
		layer.add(imageNode)
		stage.add(layer)

		refit()
		loaded.value = true
	} catch (error) {
		emit('error', error instanceof Error ? error : new Error(String(error)))
	}
}

/**
 * Export the edited image at its natural resolution.
 *
 * @param options target format and quality
 */
async function exportImage(options: ExportOptions = {}): Promise<ExportResult> {
	if (stage === null || fit === null || sourceImage === null) {
		throw new Error('No image loaded')
	}

	// Render the image area of the stage back at natural resolution,
	// excluding the letterbox padding around it
	const canvas = stage.toCanvas({
		x: fit.x,
		y: fit.y,
		width: fit.width,
		height: fit.height,
		pixelRatio: 1 / fit.scale,
	})

	const mimeType = options.format ?? 'image/png'
	const blob = await canvasToBlob(canvas, mimeType, options.quality)
	return {
		blob,
		width: sourceImage.naturalWidth,
		height: sourceImage.naturalHeight,
		mimeType,
	}
}

/**
 * Export and emit the result as a save event.
 */
async function onSave(): Promise<void> {
	try {
		emit('save', await exportImage())
	} catch (error) {
		emit('error', error instanceof Error ? error : new Error(String(error)))
	}
}

onMounted(() => {
	resizeObserver = new ResizeObserver(refit)
	resizeObserver.observe(container.value!)
	load()
})

watch(() => props.src, load)

onBeforeUnmount(() => {
	resizeObserver?.disconnect()
	stage?.destroy()
	stage = null
})

defineExpose({ exportImage })
</script>

<template>
	<div class="image-editor">
		<div
			ref="container"
			class="image-editor__canvas"
			role="img"
			:aria-label="label ?? canvasLabel" />
		<div class="image-editor__toolbar">
			<NcButton @click="emit('cancel')">
				{{ t('Cancel') }}
			</NcButton>
			<NcButton variant="primary" :disabled="!loaded" @click="onSave">
				{{ t('Save') }}
			</NcButton>
		</div>
	</div>
</template>

<style scoped lang="scss">
.image-editor {
	display: flex;
	flex-direction: column;
	height: 100%;
	width: 100%;

	&__canvas {
		flex: 1;
		min-height: 0;
	}

	&__toolbar {
		display: flex;
		justify-content: flex-end;
		gap: calc(var(--default-grid-baseline) * 2);
		padding: calc(var(--default-grid-baseline) * 2);
	}
}
</style>
