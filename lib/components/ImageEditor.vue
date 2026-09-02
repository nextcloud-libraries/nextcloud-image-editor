<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { TransitionContext, TransitionKind, TransitionTarget } from '../editor/animate.ts'
import type { Tool } from '../editor/context.ts'
import type { CropOverlay } from '../editor/cropOverlay.ts'
import type { Scene, SceneOptions } from '../editor/render.ts'
import type { Selection } from '../editor/selection.ts'
import type { EditorState, Rect, Size } from '../editor/state.ts'
import type { ViewFit } from '../editor/view.ts'
import type { ExportResult } from '../types/export.ts'

import Konva from 'konva'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue'
import NcLoadingIcon from '@nextcloud/vue/components/NcLoadingIcon'
import EditorPanel from './EditorPanel.vue'
import EditorSidebar from './EditorSidebar.vue'
import EditorTopBar from './EditorTopBar.vue'
import SelectionToolbar from './SelectionToolbar.vue'
import TextOverlay from './TextOverlay.vue'
import { useAmbient } from '../composables/useAmbient.ts'
import { useAnnouncements } from '../composables/useAnnouncements.ts'
import { useEditorShortcuts } from '../composables/useEditorShortcuts.ts'
import { useExportImage } from '../composables/useExportImage.ts'
import { useTextEditing } from '../composables/useTextEditing.ts'
import { useWheelControls } from '../composables/useWheelControls.ts'
import { playTransition } from '../editor/animate.ts'
import { provideEditorCommands } from '../editor/commands.ts'
import { createEditorContext } from '../editor/context.ts'
import { attachCropOverlay } from '../editor/cropOverlay.ts'
import { orientImage } from '../editor/orient.ts'
import { createScene, toImageCoords, visibleRect } from '../editor/render.ts'
import { attachSelection } from '../editor/selection.ts'
import { createInitialState, duplicateAnnotation, flipHorizontal, flipVertical, rotateCW } from '../editor/state.ts'
import { attachPointerTools } from '../editor/tools.ts'
import { clampPan, panBounds, VIEW_MARGIN } from '../editor/view.ts'
import { fitContain } from '../utils/geometry.ts'
import { loadImage } from '../utils/image.ts'
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

const context = createEditorContext()
const container = useTemplateRef<HTMLDivElement>('container')
const loaded = ref(false)
const errored = ref(false)
const containerSize = shallowRef<Size>({ width: 0, height: 0 })
const orientedCanvas = shallowRef<HTMLCanvasElement | null>(null)
const sourceImage = shallowRef<HTMLImageElement | null>(null)
const { ambient, backdrop } = useAmbient(sourceImage)
const { panArmed } = useWheelControls(container, context)
const announcement = useAnnouncements(context)

/** Stage-space bounds of the selected annotation, for the mini toolbar */
const selectionBox = shallowRef<{ x: number, y: number, width: number, height: number } | null>(null)

// Konva objects are deliberately non-reactive: proxying them breaks
// their internal caching and costs performance for no benefit.
let stage: Konva.Stage | null = null
let scene: Scene | null = null
let cropOverlay: CropOverlay | null = null
let selection: Selection | null = null
let detachTool: (() => void) | null = null
// What the attached tool was built for. A view change is no reason to
// rebuild it: tearing the crop overlay down on every render cost the
// user the rectangle they were drawing as soon as they zoomed or the
// container resized.
let attached: { tool: Tool, oriented: HTMLCanvasElement, crop: Rect | null } | null = null
let resizeObserver: ResizeObserver | null = null
let pendingTransition: { kind: TransitionKind, context: TransitionContext } | null = null
// The view metrics of the last completed render: transition capture
// must not read the lazy computed, it already reflects the new mode
let lastView: TransitionContext | null = null

const canvasCursor = computed(() => {
	if (context.panning.value) {
		return 'grabbing'
	}
	if (panArmed.value) {
		return 'grab'
	}
	const tool = context.activeTool.value
	if (['draw', 'rectangle', 'ellipse', 'arrow', 'text', 'sticker', 'redact'].includes(tool)) {
		return 'crosshair'
	}
	return 'default'
})

/**
 * The fitted view, before the view zoom and pan apply. Published to the
 * context so the view setters clamp panning against the same metrics.
 */
const viewFit = computed<ViewFit | null>(() => {
	const oriented = orientedCanvas.value
	if (oriented === null || containerSize.value.width === 0 || containerSize.value.height === 0) {
		return null
	}
	const showCropped = context.activeTool.value !== 'crop'
	const visible = showCropped
		? visibleRect(context.state.value, { width: oriented.width, height: oriented.height })
		: { x: 0, y: 0, width: oriented.width, height: oriented.height }
	const container = containerSize.value
	// Small stage margin so crop handles at the image edge stay visible
	const fit = fitContain(
		{ width: visible.width, height: visible.height },
		{
			width: Math.max(1, container.width - VIEW_MARGIN * 2),
			height: Math.max(1, container.height - VIEW_MARGIN * 2),
		},
	)
	return { scale: fit.scale, visible, container, showCropped }
})

const viewOptions = computed<SceneOptions | null>(() => {
	const fit = viewFit.value
	if (fit === null) {
		return null
	}
	// View zoom magnifies around the center; panning shifts the view but
	// content edges never pass the container edges
	const scale = fit.scale * context.viewZoom.value
	const pan = clampPan(context.viewPan.value, panBounds(fit.visible, scale, fit.container))
	return {
		scale,
		offset: {
			x: (fit.container.width - fit.visible.width * scale) / 2 + pan.x,
			y: (fit.container.height - fit.visible.height * scale) / 2 + pan.y,
		},
		showCropped: fit.showCropped,
		fastFilters: context.interacting.value,
	}
})

const { textEdit, startTextEdit, confirmTextEdit } = useTextEditing({
	context,
	viewOptions: () => viewOptions.value,
	oriented: () => orientedCanvas.value,
})

const { exportImage, save: onSave } = useExportImage({
	oriented: () => orientedCanvas.value,
	getState: () => context.state.value,
	onSaved: (result) => emit('save', result),
	onError: (error) => emit('error', error),
})

/**
 * Snapshot the current view metrics, taken right before an animated
 * edit so the transition can start from the old view.
 */
function captureView(): TransitionContext {
	return lastView ?? { previousScale: 1, previousOffset: { x: 0, y: 0 }, previousOrigin: { x: 0, y: 0 } }
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

	stage.size(containerSize.value)
	scene ??= createScene(stage)
	scene.update(oriented, context.state.value, options)

	const renderedOrigin = options.showCropped
		? visibleRect(context.state.value, { width: oriented.width, height: oriented.height })
		: { x: 0, y: 0 }

	// Before the transition: the overlays it carries have to exist, and
	// already sit where the new state puts them
	syncTools(oriented, options)

	if (pendingTransition !== null) {
		const visible = options.showCropped
			? visibleRect(context.state.value, { width: oriented.width, height: oriented.height })
			: { x: 0, y: 0, width: oriented.width, height: oriented.height }
		const center = {
			x: visible.x + visible.width / 2,
			y: visible.y + visible.height / 2,
		}
		const targets: TransitionTarget[] = [{
			node: scene.contentGroup,
			pivot: center,
			unit: 1 / options.scale,
		}]
		if (cropOverlay !== null) {
			// The same point, in the stage space the overlay draws in
			targets.push({
				node: cropOverlay.layer,
				pivot: {
					x: options.offset.x + (center.x - renderedOrigin.x) * options.scale,
					y: options.offset.y + (center.y - renderedOrigin.y) * options.scale,
				},
				unit: 1,
			})
		}
		playTransition(pendingTransition.kind, {
			targets,
			scale: options.scale,
			offset: options.offset,
			origin: renderedOrigin,
		}, pendingTransition.context)
		pendingTransition = null
	}

	lastView = {
		previousScale: options.scale,
		previousOffset: options.offset,
		previousOrigin: { x: renderedOrigin.x, y: renderedOrigin.y },
	}
}

/**
 * Bring the attached tool in line with the rendered scene. Only a
 * different tool, a re-baked source canvas or a committed crop is a
 * reason to rebuild it; a pan, a zoom or a resize is not, and neither
 * is a commit that merely changed the annotations.
 *
 * @param oriented the orientation-baked source canvas
 * @param options the view transform just rendered
 */
function syncTools(oriented: HTMLCanvasElement, options: SceneOptions): void {
	if (stage === null) {
		return
	}
	const tool = context.activeTool.value
	const crop = context.state.value.crop
	const fresh = attached !== null
		&& attached.tool === tool
		&& attached.oriented === oriented
		&& attached.crop === crop

	if (fresh) {
		// The scene reconciled, so the selection has to re-find its node
		selection?.sync()
		cropOverlay?.update({
			oriented: { width: oriented.width, height: oriented.height },
			scale: options.scale,
			offset: options.offset,
		})
		return
	}

	detachTool?.()
	detachTool = null
	selection?.detach()
	selection = null
	cropOverlay?.destroy()
	cropOverlay = null
	attached = { tool, oriented, crop }

	if (tool === 'select') {
		selection = attachSelection({
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
			initial: crop,
		})
		applyCropAspect()
	} else if (tool !== 'adjust') {
		detachTool = attachPointerTools(tool, {
			stage,
			contentGroup: () => scene?.contentGroup ?? null,
			oriented: () => orientedCanvas.value,
			getState: () => context.state.value,
			commit: context.commit,
			// Read the live view: the tool outlives the transform it was
			// attached under
			toScene: (pointer) => toImageCoords(
				pointer,
				context.state.value,
				{ width: oriented.width, height: oriented.height },
				viewOptions.value ?? options,
			),
			panning: () => context.panning.value,
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
 * Push the chosen aspect lock into the live crop overlay.
 */
function applyCropAspect(): void {
	if (cropOverlay === null) {
		return
	}
	const aspect = context.cropAspect.value
	const oriented = orientedCanvas.value
	if (aspect === 'original' && oriented !== null) {
		cropOverlay.setAspect(oriented.width / oriented.height)
	} else {
		cropOverlay.setAspect(typeof aspect === 'number' ? aspect : null)
	}
}

/**
 * Regenerate the orientation-baked canvas after rotation/flip changes.
 */
function refreshOrientedCanvas(): void {
	if (sourceImage.value === null) {
		return
	}
	orientedCanvas.value = orientImage(sourceImage.value, context.state.value)
}

/**
 * Load the source image and reset the editing session.
 */
async function load(): Promise<void> {
	loaded.value = false
	errored.value = false
	try {
		sourceImage.value = await loadImage(props.src)
		context.reset()
		// Sensible text size relative to the image resolution
		const minDimension = Math.min(sourceImage.value.naturalWidth, sourceImage.value.naturalHeight)
		context.fontSize.value = Math.min(128, Math.max(12, Math.round(minDimension / 15)))
		pendingTransition = { kind: 'load', context: captureView() }
		refreshOrientedCanvas()
		loaded.value = true
	} catch (error) {
		errored.value = true
		emit('error', error instanceof Error ? error : new Error(String(error)))
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

useEditorShortcuts({
	context,
	isTextEditing: () => textEdit.value !== null,
	onDelete: onDeleteSelection,
	onEscape: () => {
		if (context.selectedId.value !== null) {
			context.selectedId.value = null
			renderView()
		} else if (context.activeMode.value === 'crop') {
			// Leave crop without applying the scratch selection
			context.setMode('select')
		} else if (context.activeMode.value === 'annotate' && context.activeTool.value !== 'select') {
			context.activeTool.value = 'select'
		}
	},
})
// Published for the view setters: they clamp panning against the fit
watch(viewFit, (fit) => {
	context.viewFit.value = fit
}, { immediate: true })

provideEditorCommands({
	rotateCW: onRotateCW,
	rotateCCW: onRotateCCW,
	flipHorizontal: onFlipHorizontal,
	flipVertical: onFlipVertical,
	applyCrop: onApplyCrop,
	resetCrop: onResetCrop,
	revert: onRevert,
})

watch(() => props.src, load)
// Separate sources so the compare is per value: a getter returning a
// fresh array would fire on every commit and re-bake the source canvas
watch(
	[
		() => context.state.value.rotation,
		() => context.state.value.flipX,
		() => context.state.value.flipY,
		() => context.state.value.fineRotation,
		() => context.state.value.zoom,
	],
	refreshOrientedCanvas,
)
// context.interacting belongs here: a slider commits the state object
// it previewed, which a shallow ref treats as no change, so nothing
// else would re-render the scene at full filter quality afterwards
watch(
	[context.state, context.activeTool, context.activeMode, context.viewZoom, context.viewPan, context.interacting, orientedCanvas, containerSize],
	renderView,
)
watch(context.cropAspect, applyCropAspect)

// The color control follows the selection and edits it in place.
// Stickers keep their color field untouched: the emoji glyph never
// shows it, and a write would only pollute the undo history.
watch(context.selectedId, (id) => {
	const annotation = context.state.value.annotations.find((entry) => entry.id === id)
	if (annotation !== undefined && 'color' in annotation && annotation.type !== 'sticker') {
		context.drawColor.value = annotation.color
	}
})
watch(context.drawColor, (color) => {
	const id = context.selectedId.value
	const state = context.state.value
	const annotation = state.annotations.find((entry) => entry.id === id)
	if (annotation === undefined || !('color' in annotation) || annotation.type === 'sticker' || annotation.color === color) {
		return
	}
	context.commit({
		...state,
		annotations: state.annotations.map((entry) => entry.id === id ? { ...entry, color } : entry),
	})
})
watch(context.state, (state) => emit('change', structuredClone(state)))

onMounted(() => {
	stage = new Konva.Stage({ container: container.value!, width: 1, height: 1 })
	resizeObserver = new ResizeObserver(() => {
		const { clientWidth, clientHeight } = container.value!
		containerSize.value = { width: clientWidth, height: clientHeight }
	})
	resizeObserver.observe(container.value!)
	load()
})

onBeforeUnmount(() => {
	resizeObserver?.disconnect()
	detachTool?.()
	selection?.detach()
	cropOverlay?.destroy()
	scene?.destroy()
	scene = null
	stage?.destroy()
	stage = null
})

defineExpose({ exportImage })
</script>

<template>
	<div
		class="image-editor"
		:style="{
			'--editor-ambient': ambient,
			'--editor-backdrop': backdrop ? `url(${backdrop})` : 'none',
		}">
		<div class="image-editor__shell">
			<div class="image-editor__frame">
				<div class="image-editor__viewport">
					<div
						ref="container"
						class="image-editor__canvas"
						:style="{ cursor: canvasCursor }"
						role="img"
						:aria-label="label ?? canvasLabel" />
					<NcLoadingIcon
						v-if="!loaded && !errored"
						class="image-editor__loading"
						:size="44" />
					<TextOverlay
						v-if="textEdit !== null"
						:x="textEdit.screenX"
						:y="textEdit.screenY"
						:font-size="textEdit.screenFontSize"
						:color="textEdit.color"
						:initial="textEdit.value"
						@confirm="confirmTextEdit"
						@cancel="textEdit = null" />
					<SelectionToolbar
						v-if="selectionBox !== null"
						:box="selectionBox"
						@duplicate="onDuplicateSelection"
						@delete="onDeleteSelection" />
				</div>

				<EditorTopBar
					class="image-editor__topbar"
					:loaded="loaded"
					@save="onSave"
					@cancel="emit('cancel')" />

				<EditorPanel
					:class="context.activeMode.value === 'filter'
						? 'image-editor__strip'
						: 'image-editor__controls'"
					:loaded="loaded"
					:oriented="orientedCanvas" />

				<EditorSidebar class="image-editor__rail" :loaded="loaded" />
				<span class="hidden-visually" role="status" aria-live="polite">{{ announcement }}</span>
			</div>
		</div>
	</div>
</template>

<style scoped lang="scss">
.image-editor {
	// Always-dark chrome floating over the image, every surface tinted
	// by the image itself: --editor-ambient carries its dominant color,
	// --editor-backdrop a tiny blurred copy used as the wallpaper
	--color-main-text: #f2f2f7;
	--color-main-background: #141416;
	--color-background-hover: rgba(255, 255, 255, 0.08);
	--color-background-dark: rgba(255, 255, 255, 0.14);
	--color-border: rgba(255, 255, 255, 0.09);
	--color-element-hover: rgba(255, 255, 255, 0.08);
	--editor-glass: rgba(20, 20, 26, 0.6);
	// Mirrors of the Nextcloud server constants. The component is also
	// embedded outside a server page, in the playground, the demo and
	// host apps that mount it standalone, and @nextcloud/vue sizes its
	// controls from --default-clickable-area with no fallback of its
	// own: without these the buttons collapse to their content and fall
	// under the minimum pointer target.
	--default-clickable-area: 44px;
	--default-grid-baseline: 4px;
	font-size: 13px;

	position: relative;
	height: 100%;
	width: 100%;
	overflow: hidden;
	color: var(--color-main-text);
	background-color: var(--color-main-background);
	// Layout adapts to the editor's own size, not the viewport: the
	// component embeds in arbitrary app layouts. Note: rules for the
	// container itself cannot live in @container blocks, only
	// descendants can respond: hence the shell wrapper.
	container: editor / size;

	&,
	& :deep(*),
	& :deep(*)::before,
	& :deep(*)::after {
		box-sizing: border-box;
	}

	// Full-window implementation, author decision: the editor fills its
	// host without a floating card frame
	&__shell {
		position: relative;
		height: 100%;
		width: 100%;
	}

	// Blurred image wallpaper bleeding around the editor card
	&::before {
		content: '';
		position: absolute;
		inset: -10%;
		background-image: var(--editor-backdrop);
		background-size: cover;
		background-position: center;
		filter: blur(64px) saturate(1.3) brightness(0.55);
		transform: scale(1.15);
	}

	&__frame {
		position: relative;
		height: 100%;
		width: 100%;
		overflow: hidden;
		background: rgba(14, 14, 18, 0.55);
		backdrop-filter: blur(40px);
	}

	&__viewport {
		position: absolute;
		inset: 0;
		// The stage runs under the floating glass chrome; the fit margin
		// keeps interactive handles visible
		padding: 56px 16px 16px;
	}

	@container editor (max-width: 600px) {

		&__viewport {
			padding: 56px 8px 8px;
		}

		// Doubled class specificity so these beat the card's own sizing
		& .image-editor__controls {
			inset-inline: 8px;
			transform: none;
			min-width: 0;
			max-width: none;
			width: auto;
		}

		// The preset strip lies down above the bottom edge on phones
		& .image-editor__strip {
			flex-direction: row;
			inset-inline: 8px;
			inset-block-start: auto;
			inset-block-end: calc(var(--default-grid-baseline) * 4);
			transform: none;
			max-height: none;
			overflow-x: auto;
			overflow-y: hidden;
		}

		// Anchored under the top bar with its height capped so it can
		// never collide with the bottom control card, and given its own
		// glass backing since it floats over the image on phones.
		// Doubled class specificity so this beats the base rail rules
		// further down the sheet.
		& .image-editor__rail {
			inset-inline-start: var(--default-grid-baseline);
			inset-block-start: 64px;
			transform: none;
			max-height: calc(100% - 240px);
			overflow-y: auto;
			padding: var(--default-grid-baseline);
			background: var(--editor-glass);
			backdrop-filter: blur(24px) saturate(1.4);
			border: 1px solid rgba(255, 255, 255, 0.09);
			border-radius: var(--border-radius-large, 12px);
		}
	}

	&__canvas {
		height: 100%;
		width: 100%;
		// Pinch and drag gestures belong to the editor, not the browser
		touch-action: none;
	}

	&__topbar {
		position: absolute;
		inset-block-start: 0;
		inset-inline: 0;
		// Legibility scrim over bright images
		background: linear-gradient(rgba(8, 8, 12, 0.5), transparent);
	}

	&__rail {
		position: absolute;
		inset-inline-start: calc(var(--default-grid-baseline) * 4);
		inset-block-start: 50%;
		transform: translateY(-50%);
	}

	&__controls {
		position: absolute;
		inset-block-end: calc(var(--default-grid-baseline) * 5);
		inset-inline-start: 50%;
		transform: translateX(-50%);
	}

	&__strip {
		position: absolute;
		inset-inline-end: calc(var(--default-grid-baseline) * 4);
		inset-block-start: 50%;
		transform: translateY(-50%);
		max-height: calc(100% - 160px);
	}

	.hidden-visually {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}

	&__loading {
		position: absolute;
		inset: 0;
		margin: auto;
	}

}
</style>
