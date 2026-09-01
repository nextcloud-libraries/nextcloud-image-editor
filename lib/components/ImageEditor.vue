<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { TransitionContext, TransitionKind } from '../editor/animate.ts'
import type { CropOverlay } from '../editor/cropOverlay.ts'
import type { Scene, SceneOptions } from '../editor/render.ts'
import type { EditorState, Size, TextAnnotation } from '../editor/state.ts'
import type { ExportOptions, ExportResult } from '../types/index.ts'

import Konva from 'konva'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import ContentCopy from 'vue-material-design-icons/ContentCopy.vue'
import Delete from 'vue-material-design-icons/Delete.vue'
import EditorPanel from './EditorPanel.vue'
import EditorSidebar from './EditorSidebar.vue'
import EditorTopBar from './EditorTopBar.vue'
import TextOverlay from './TextOverlay.vue'
import { playTransition } from '../editor/animate.ts'
import { createEditorContext } from '../editor/context.ts'
import { attachCropOverlay } from '../editor/cropOverlay.ts'
import { orientImage } from '../editor/orient.ts'
import { renderScene, renderToCanvas, toImageCoords, visibleRect } from '../editor/render.ts'
import { attachSelection } from '../editor/selection.ts'
import { createInitialState, duplicateAnnotation, flipHorizontal, flipVertical, rotateCW } from '../editor/state.ts'
import { attachPointerTools } from '../editor/tools.ts'
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
	change: [state: EditorState]
}>()

const canvasLabel = t('Image editor')
const duplicateLabel = t('Duplicate')
const deleteLabel = t('Delete')

const context = createEditorContext()
const container = useTemplateRef<HTMLDivElement>('container')
const loaded = ref(false)
const containerSize = shallowRef<Size>({ width: 0, height: 0 })
const orientedCanvas = shallowRef<HTMLCanvasElement | null>(null)

interface TextEdit {
	sceneX: number
	sceneY: number
	screenX: number
	screenY: number
	screenFontSize: number
	color: string
	value: string
	/** Existing annotation being edited, null when creating */
	id: string | null
}
const textEdit = ref<TextEdit | null>(null)

/** Stage-space bounds of the selected annotation, for the mini toolbar */
const selectionBox = shallowRef<{ x: number, y: number, width: number, height: number } | null>(null)

// Konva objects are deliberately non-reactive: proxying them breaks
// their internal caching and costs performance for no benefit.
let stage: Konva.Stage | null = null
let scene: Scene | null = null
let sourceImage: HTMLImageElement | null = null
let cropOverlay: CropOverlay | null = null
let detachTool: (() => void) | null = null
let resizeObserver: ResizeObserver | null = null
let pendingTransition: { kind: TransitionKind, context: TransitionContext } | null = null

const canvasCursor = computed(() => {
	const tool = context.activeTool.value
	return ['draw', 'rectangle', 'ellipse', 'arrow', 'text', 'sticker', 'redact'].includes(tool)
		? 'crosshair'
		: 'default'
})

const viewOptions = computed<SceneOptions | null>(() => {
	const oriented = orientedCanvas.value
	if (oriented === null || containerSize.value.width === 0 || containerSize.value.height === 0) {
		return null
	}
	const showCropped = context.activeTool.value !== 'crop'
	const state = context.state.value
	const visible = showCropped
		? visibleRect(state, { width: oriented.width, height: oriented.height })
		: { x: 0, y: 0, width: oriented.width, height: oriented.height }
	const fit = fitContain({ width: visible.width, height: visible.height }, containerSize.value)
	return { scale: fit.scale, offset: { x: fit.x, y: fit.y }, showCropped }
})

/**
 * Snapshot the current view metrics, taken right before an animated
 * edit so the transition can start from the old view.
 */
function captureView(): TransitionContext {
	const options = viewOptions.value
	const oriented = orientedCanvas.value
	if (options === null || oriented === null) {
		return { previousScale: 1, previousOffset: { x: 0, y: 0 }, previousOrigin: { x: 0, y: 0 } }
	}
	const origin = options.showCropped
		? visibleRect(context.state.value, { width: oriented.width, height: oriented.height })
		: { x: 0, y: 0 }
	return {
		previousScale: options.scale,
		previousOffset: options.offset,
		previousOrigin: { x: origin.x, y: origin.y },
	}
}

/**
 * Commit a state change and play a view transition on the rebuilt scene.
 *
 * @param kind which transition to play
 * @param next the state to commit
 */
function commitWithTransition(kind: TransitionKind, next: EditorState): void {
	pendingTransition = { kind, context: captureView() }
	context.commit(next)
}

/**
 * Rebuild the stage from the current state and reattach the active tool.
 */
function renderView(): void {
	const oriented = orientedCanvas.value
	const options = viewOptions.value
	if (stage === null || oriented === null || options === null) {
		return
	}

	detachTool?.()
	detachTool = null
	cropOverlay?.destroy()
	cropOverlay = null

	stage.size(containerSize.value)
	scene = renderScene(stage, oriented, context.state.value, options)

	if (pendingTransition !== null) {
		const visible = options.showCropped
			? visibleRect(context.state.value, { width: oriented.width, height: oriented.height })
			: { x: 0, y: 0, width: oriented.width, height: oriented.height }
		playTransition(pendingTransition.kind, {
			group: scene.contentGroup,
			container: containerSize.value,
			visible,
			scale: options.scale,
		}, pendingTransition.context)
		pendingTransition = null
	}

	const tool = context.activeTool.value
	if (tool === 'select') {
		detachTool = attachSelection({
			stage,
			getState: () => context.state.value,
			commit: context.commit,
			select: (id) => {
				context.selectedId.value = id
			},
			getSelectedId: () => context.selectedId.value,
			editText: (annotation) => startTextEdit({ x: annotation.x, y: annotation.y }, annotation),
			onSelectionRect: (rect) => {
				selectionBox.value = rect
			},
		})
	} else if (tool === 'crop') {
		cropOverlay = attachCropOverlay({
			stage,
			oriented: { width: oriented.width, height: oriented.height },
			scale: options.scale,
			offset: options.offset,
			initial: context.state.value.crop,
		})
	} else if (tool !== 'adjust') {
		detachTool = attachPointerTools(tool, {
			stage,
			contentGroup: () => scene?.contentGroup ?? null,
			oriented: () => orientedCanvas.value,
			getState: () => context.state.value,
			commit: context.commit,
			toScene: (pointer) => toImageCoords(
				pointer,
				context.state.value,
				{ width: oriented.width, height: oriented.height },
				options,
			),
			options: () => ({
				color: context.drawColor.value,
				strokeWidth: context.strokeWidth.value,
				fontSize: context.fontSize.value,
				sticker: context.sticker.value,
				redactStyle: context.redactStyle.value,
			}),
			startTextEdit: (position) => startTextEdit(position),
		})
	}
}

/**
 * Regenerate the orientation-baked canvas after rotation/flip changes.
 */
function refreshOrientedCanvas(): void {
	if (sourceImage === null) {
		return
	}
	orientedCanvas.value = orientImage(sourceImage, context.state.value)
}

/**
 * Load the source image and reset the editing session.
 */
async function load(): Promise<void> {
	loaded.value = false
	try {
		sourceImage = await loadImage(props.src)
		context.reset()
		// Sensible text size relative to the image resolution
		const minDimension = Math.min(sourceImage.naturalWidth, sourceImage.naturalHeight)
		context.fontSize.value = Math.min(128, Math.max(12, Math.round(minDimension / 15)))
		pendingTransition = { kind: 'load', context: captureView() }
		refreshOrientedCanvas()
		loaded.value = true
	} catch (error) {
		emit('error', error instanceof Error ? error : new Error(String(error)))
	}
}

/**
 * Open the text overlay at a scene position, optionally editing an
 * existing annotation.
 *
 * @param position scene coordinates of the text anchor
 * @param position.x horizontal scene coordinate
 * @param position.y vertical scene coordinate
 * @param existing annotation to edit instead of creating one
 */
function startTextEdit(position: { x: number, y: number }, existing?: TextAnnotation): void {
	const options = viewOptions.value
	const oriented = orientedCanvas.value
	if (options === null || oriented === null) {
		return
	}
	const origin = options.showCropped
		? visibleRect(context.state.value, { width: oriented.width, height: oriented.height })
		: { x: 0, y: 0 }
	textEdit.value = {
		sceneX: position.x,
		sceneY: position.y,
		screenX: options.offset.x + (position.x - origin.x) * options.scale,
		screenY: options.offset.y + (position.y - origin.y) * options.scale,
		screenFontSize: (existing?.fontSize ?? context.fontSize.value) * options.scale,
		color: existing?.color ?? context.drawColor.value,
		value: existing?.text ?? '',
		id: existing?.id ?? null,
	}
}

/**
 * Commit the text overlay content into the state.
 *
 * @param text the entered text
 */
function confirmTextEdit(text: string): void {
	const edit = textEdit.value
	textEdit.value = null
	if (edit === null) {
		return
	}
	const state = context.state.value
	const trimmed = text.trim()

	if (edit.id !== null) {
		context.commit({
			...state,
			annotations: trimmed === ''
				? state.annotations.filter((annotation) => annotation.id !== edit.id)
				: state.annotations.map((annotation) => annotation.id === edit.id ? { ...annotation, text: trimmed } : annotation),
		})
	} else if (trimmed !== '') {
		context.commit({
			...state,
			annotations: [...state.annotations, {
				id: crypto.randomUUID(),
				type: 'text',
				x: edit.sceneX,
				y: edit.sceneY,
				text: trimmed,
				color: edit.color,
				fontSize: context.fontSize.value,
				rotation: 0,
			}],
		})
	}
}

/**
 *
 */
function currentOriented(): Size {
	const oriented = orientedCanvas.value!
	return { width: oriented.width, height: oriented.height }
}

/**
 * Rotate the image 90° clockwise.
 */
function onRotateCW(): void {
	commitWithTransition('rotate-cw', rotateCW(context.state.value, currentOriented()))
}

/**
 * Rotate the image 90° counter-clockwise (three clockwise turns).
 */
function onRotateCCW(): void {
	let state = context.state.value
	let oriented = currentOriented()
	for (let i = 0; i < 3; i++) {
		state = rotateCW(state, oriented)
		oriented = { width: oriented.height, height: oriented.width }
	}
	commitWithTransition('rotate-ccw', state)
}

/**
 * Mirror the image horizontally.
 */
function onFlipHorizontal(): void {
	commitWithTransition('flip-h', flipHorizontal(context.state.value, currentOriented()))
}

/**
 * Mirror the image vertically.
 */
function onFlipVertical(): void {
	commitWithTransition('flip-v', flipVertical(context.state.value, currentOriented()))
}

/**
 * Apply the crop overlay rect and zoom into the cropped view.
 */
function onApplyCrop(): void {
	if (cropOverlay !== null) {
		const crop = cropOverlay.getRect()
		// Capture before the mode switches so the zoom starts from the
		// full-image crop view
		pendingTransition = { kind: 'crop', context: captureView() }
		context.commit({ ...context.state.value, crop })
		context.setMode('annotate')
	}
}

/**
 * Duplicate the selected annotation and select the copy.
 */
function onDuplicateSelection(): void {
	const id = context.selectedId.value
	const state = context.state.value
	const annotation = state.annotations.find((entry) => entry.id === id)
	if (annotation === undefined) {
		return
	}
	const copy = duplicateAnnotation(annotation)
	context.commit({ ...state, annotations: [...state.annotations, copy] })
	context.selectedId.value = copy.id
	renderView()
}

/**
 * Revert every edit as one undoable step.
 */
function onRevert(): void {
	context.commit(createInitialState())
}

/**
 * Drop the crop and return to the full image.
 */
function onResetCrop(): void {
	context.commit({ ...context.state.value, crop: null })
}

/**
 *
 */
function onDeleteSelection(): void {
	const id = context.selectedId.value
	if (id === null) {
		return
	}
	const state = context.state.value
	context.selectedId.value = null
	context.commit({
		...state,
		annotations: state.annotations.filter((annotation) => annotation.id !== id),
	})
}

/**
 * Delete the selection or leave the current tool/selection via keyboard.
 *
 * @param event the keyboard event
 */
function onKeydown(event: KeyboardEvent): void {
	if (textEdit.value !== null) {
		return
	}
	if ((event.key === 'Delete' || event.key === 'Backspace') && context.selectedId.value !== null) {
		event.preventDefault()
		onDeleteSelection()
	} else if (event.key === 'Escape') {
		if (context.selectedId.value !== null) {
			context.selectedId.value = null
			renderView()
		} else if (context.activeMode.value === 'annotate' && context.activeTool.value !== 'select') {
			context.activeTool.value = 'select'
		}
	}
}

/**
 * Export the edited image.
 *
 * @param options target format, quality and size bound
 */
async function exportImage(options: ExportOptions = {}): Promise<ExportResult> {
	const oriented = orientedCanvas.value
	if (oriented === null) {
		throw new Error('No image loaded')
	}
	const canvas = renderToCanvas(oriented, context.state.value, options.maxSize)
	const mimeType = options.format ?? 'image/png'
	const blob = await canvasToBlob(canvas, mimeType, options.quality)
	return { blob, width: canvas.width, height: canvas.height, mimeType }
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

watch(() => props.src, load)
watch(
	() => {
		const { rotation, flipX, flipY, fineRotation, zoom } = context.state.value
		return [rotation, flipX, flipY, fineRotation, zoom]
	},
	refreshOrientedCanvas,
)
watch([context.state, context.activeTool, context.viewZoom, orientedCanvas, containerSize], renderView)
watch(context.state, (state) => emit('change', structuredClone(state)))

onMounted(() => {
	stage = new Konva.Stage({ container: container.value!, width: 1, height: 1 })
	resizeObserver = new ResizeObserver(() => {
		const { clientWidth, clientHeight } = container.value!
		containerSize.value = { width: clientWidth, height: clientHeight }
	})
	resizeObserver.observe(container.value!)
	window.addEventListener('keydown', onKeydown)
	load()
})

onBeforeUnmount(() => {
	window.removeEventListener('keydown', onKeydown)
	resizeObserver?.disconnect()
	detachTool?.()
	cropOverlay?.destroy()
	stage?.destroy()
	stage = null
})

defineExpose({ exportImage })
</script>

<template>
	<div class="image-editor">
		<EditorTopBar
			:loaded="loaded"
			@save="onSave"
			@cancel="emit('cancel')"
			@revert="onRevert" />
		<div class="image-editor__body">
			<EditorSidebar :loaded="loaded" />
			<div class="image-editor__viewport">
				<div
					ref="container"
					class="image-editor__canvas"
					:style="{ cursor: canvasCursor }"
					role="img"
					:aria-label="label ?? canvasLabel" />
				<TextOverlay
					v-if="textEdit !== null"
					:x="textEdit.screenX"
					:y="textEdit.screenY"
					:font-size="textEdit.screenFontSize"
					:color="textEdit.color"
					:initial="textEdit.value"
					@confirm="confirmTextEdit"
					@cancel="textEdit = null" />
				<div
					v-if="selectionBox !== null"
					class="image-editor__selection-toolbar"
					data-test="selection-toolbar"
					:style="{
						insetInlineStart: `${selectionBox.x + selectionBox.width / 2}px`,
						insetBlockStart: `${Math.max(4, selectionBox.y - 48)}px`,
					}">
					<NcButton
						data-test="duplicate"
						:aria-label="duplicateLabel"
						:title="duplicateLabel"
						variant="tertiary"
						@click="onDuplicateSelection">
						<template #icon>
							<ContentCopy :size="18" />
						</template>
					</NcButton>
					<NcButton
						data-test="delete"
						:aria-label="deleteLabel"
						:title="deleteLabel"
						variant="tertiary"
						@click="onDeleteSelection">
						<template #icon>
							<Delete :size="18" />
						</template>
					</NcButton>
				</div>
			</div>
			<EditorPanel
				:loaded="loaded"
				:oriented="orientedCanvas"
				@rotateCw="onRotateCW"
				@rotateCcw="onRotateCCW"
				@flipHorizontal="onFlipHorizontal"
				@flipVertical="onFlipVertical"
				@applyCrop="onApplyCrop"
				@resetCrop="onResetCrop"
				@deleteSelection="onDeleteSelection" />
		</div>
	</div>
</template>

<style scoped lang="scss">
.image-editor {
	// The editor is always dark, whatever the surrounding theme:
	// the image is the hero and the chrome recedes
	--color-main-text: #f2f2f7;
	--color-main-background: #161618;
	--color-background-hover: #26262a;
	--color-background-dark: #2e2e33;
	--color-border: rgba(255, 255, 255, 0.08);
	--color-element-hover: #26262a;
	font-size: 13px;

	display: flex;
	flex-direction: column;
	height: 100%;
	width: 100%;
	color: var(--color-main-text);
	background-color: var(--color-main-background);

	&__body {
		display: flex;
		flex: 1;
		min-height: 0;
	}

	&__viewport {
		position: relative;
		flex: 1;
		min-width: 0;
		min-height: 0;
		padding: calc(var(--default-grid-baseline) * 6);
		// The stage sits slightly darker than the chrome
		background-color: #101012;
	}

	&__canvas {
		height: 100%;
		width: 100%;
	}

	&__selection-toolbar {
		position: absolute;
		display: flex;
		gap: 2px;
		padding: 2px;
		transform: translateX(-50%);
		border-radius: var(--border-radius-pill, 100px);
		background-color: rgba(28, 28, 30, 0.85);
		backdrop-filter: blur(12px);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), inset 0 0 0 1px rgba(255, 255, 255, 0.08);
		z-index: 1;
	}
}
</style>
