<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { EditorState, ExportResult } from '../lib/index.ts'

import { computed, ref, shallowRef } from 'vue'
import ImageMultipleOutline from 'vue-material-design-icons/ImageMultipleOutline.vue'
import { createInitialState, ImageEditor } from '../lib/index.ts'
import { estimateJpegQuality } from '../lib/utils/jpeg.ts'
import demoBuilding from './demo-building.jpg'
import demoDoorway from './demo-doorway.jpg'
import demoFox from './demo-fox.jpg'
import demoFish from './demo.jpg'

const BROKEN_SRC = 'data:image/png;base64,not-an-image'

// Bundled with the playground so the demo needs no network, and each
// one a real multi-megapixel photo. They differ on purpose: the fish is
// saturated and busy, the building is flat and bright, the fox is dark
// and grainy, the doorway has a blown-out centre. Every one of them
// says something different about a filter or an adjustment.
const DEMO_PHOTOS = [
	{
		src: demoFish,
		title: 'A clown fish peeking out of a pink sea anemone',
		credit: 'Bro Takes Photos',
		link: 'https://unsplash.com/photos/a-clown-fish-peeking-out-of-a-pink-sea-anemone-jUvUDx_cb4s',
	},
	{
		src: demoBuilding,
		title: 'Beige concrete building',
		credit: 'Abbie Bernet',
		link: 'https://unsplash.com/photos/beige-concrete-building-iVmUXothgGY',
	},
	{
		src: demoFox,
		title: 'A fox rests in tall grass at dawn',
		credit: 'Daniil Silantev',
		link: 'https://unsplash.com/photos/a-fox-rests-in-tall-grass-at-dawn-Rl7SZ19fgRQ',
	},
	{
		src: demoDoorway,
		title: 'Open doorway framing a lush garden',
		credit: 'Jack Dong',
		link: 'https://unsplash.com/photos/open-doorway-framing-a-lush-garden-rWFrdp8nWWI',
	},
]

/**
 * 200x100 test image: left half red rgb(200,0,0), right half blue
 * rgb(0,0,200). Colors below full intensity keep brightness math visible.
 */
function makeFixture(): Promise<Blob> {
	const canvas = document.createElement('canvas')
	canvas.width = 200
	canvas.height = 100
	const context = canvas.getContext('2d')!
	context.fillStyle = 'rgb(200, 0, 0)'
	context.fillRect(0, 0, 100, 100)
	context.fillStyle = 'rgb(0, 0, 200)'
	context.fillRect(100, 0, 100, 100)
	return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob!)))
}

/**
 * The same 200x100 image as a JPEG written at a deliberately unusual
 * quality, so a test can tell an export that matched its source from
 * one that took the encoder's own default of 0.92.
 */
function makeQualityFixture(): Promise<Blob> {
	const canvas = document.createElement('canvas')
	canvas.width = 200
	canvas.height = 100
	const context = canvas.getContext('2d')!
	context.fillStyle = 'rgb(200, 0, 0)'
	context.fillRect(0, 0, 100, 100)
	context.fillStyle = 'rgb(0, 0, 200)'
	context.fillRect(100, 0, 100, 100)
	return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.8))
}

/**
 * 2000x1500 test image in four quadrants: red, blue, green and yellow.
 * Large enough that the fitted view is downscaled, so zooming actually
 * overflows the container and the view can be panned.
 */
function makeLargeFixture(): Promise<Blob> {
	const canvas = document.createElement('canvas')
	canvas.width = 2000
	canvas.height = 1500
	const context = canvas.getContext('2d')!
	const quadrants = [
		['rgb(200, 0, 0)', 0, 0],
		['rgb(0, 0, 200)', 1000, 0],
		['rgb(0, 200, 0)', 0, 750],
		['rgb(200, 200, 0)', 1000, 750],
	] as const
	for (const [fill, x, y] of quadrants) {
		context.fillStyle = fill
		context.fillRect(x, y, 1000, 750)
	}
	return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob!)))
}

/**
 * 2000x1500 test image of mid-gray speckled with fixed pseudo-random
 * noise, so a test can measure how much of the grain survives being
 * shown smaller: a shrink that skips pixels keeps it, one that
 * averages them smooths it out. Lossless, so the noise is exactly the
 * noise generated.
 */
function makeNoiseFixture(): Promise<Blob> {
	const canvas = document.createElement('canvas')
	canvas.width = 2000
	canvas.height = 1500
	const context = canvas.getContext('2d')!
	const image = context.createImageData(canvas.width, canvas.height)
	// A linear congruential generator, so every run gets the same grain
	let seed = 1
	for (let offset = 0; offset < image.data.length; offset += 4) {
		seed = (seed * 1103515245 + 12345) % 2147483648
		const value = 128 + ((seed >>> 16) % 81) - 40
		image.data[offset] = value
		image.data[offset + 1] = value
		image.data[offset + 2] = value
		image.data[offset + 3] = 255
	}
	context.putImageData(image, 0, 0)
	return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob!)))
}

// Byte length of the source, so a test can tell an untouched save
// (the same bytes back) from a re-encoded one
const sourceSize = ref(0)

// ?restore=1 opens with an edit already in place, standing in for a
// host resuming a session it stored earlier. The adjustments below are
// deliberately only the three that existed in 1.0.0-beta.2: a state
// stored then and handed back now is exactly the shape the editor has
// to tolerate, and e2e asserts it still renders.
const restored: EditorState | undefined
	= new URLSearchParams(window.location.search).get('restore') === null
		? undefined
		: {
				...createInitialState(),
				rotation: 90,
				adjustments: { brightness: 15, contrast: 0, saturation: 0 },
				annotations: [{
					id: 'restored-box',
					type: 'rectangle',
					rect: { x: 10, y: 10, width: 40, height: 30 },
					rotation: 0,
					color: '#00ff00',
					strokeWidth: 4,
				}],
			}

// ?src=test loads the deterministic fixture the Playwright suite probes,
// ?src=metadata a small photo carrying EXIF, GPS and XMP, ?src=quality
// a JPEG written at a known setting, ?src=wide-gamut one tagged Display
// P3, ?src=noise a large grainy one, ?src=broken an undecodable image;
// default is a real demo photo
const src = shallowRef<Blob | string | null>(null)
/** Which of the demo photos is on screen, for the shuffle button */
const photo = shallowRef(0)

// The button says what it does and what is on screen, in the tooltip
// the browser draws for a title: the credit belongs with the photo, and
// the demo page belongs to the editor
const photoHint = computed(() => {
	const current = DEMO_PHOTOS[photo.value]!
	return `Change to the next photo. Current photo "${current.title}" by ${current.credit} on Unsplash`
})
const requested = new URLSearchParams(window.location.search).get('src')
if (requested === 'broken') {
	src.value = BROKEN_SRC
} else if (requested === 'test') {
	makeFixture().then((blob) => {
		sourceSize.value = blob.size
		src.value = blob
	})
} else if (requested === 'metadata') {
	fetch('with-metadata.jpg')
		.then((response) => response.blob())
		.then((blob) => {
			sourceSize.value = blob.size
			// The editor only has metadata to carry when it is handed bytes
			src.value = new Blob([blob], { type: 'image/jpeg' })
		})
} else if (requested === 'wide-gamut') {
	fetch('wide-gamut.jpg')
		.then((response) => response.blob())
		.then((blob) => {
			sourceSize.value = blob.size
			// Tagged Display P3: what the editor gives back has to look
			// like what it was handed, whatever the browser does on decode
			src.value = new Blob([blob], { type: 'image/jpeg' })
		})
} else if (requested === 'quality') {
	makeQualityFixture().then((blob) => {
		sourceSize.value = blob.size
		src.value = blob
	})
} else if (requested === 'large') {
	makeLargeFixture().then((blob) => {
		sourceSize.value = blob.size
		src.value = blob
	})
} else if (requested === 'noise') {
	makeNoiseFixture().then((blob) => {
		sourceSize.value = blob.size
		src.value = blob
	})
} else {
	// A different photo each visit, so the demo page is not one picture
	// forever, and a button to move on when the one that loaded does not
	// show what is being looked at
	photo.value = Math.floor(Math.random() * DEMO_PHOTOS.length)
	src.value = DEMO_PHOTOS[photo.value]!.src
}

/**
 * Show the next demo photo, wrapping around at the end.
 */
function nextPhoto() {
	photo.value = (photo.value + 1) % DEMO_PHOTOS.length
	src.value = DEMO_PHOTOS[photo.value]!.src
}

const saved = ref('')
const stateJson = ref('')
const changes = ref(0)
const saving = ref(false)
const cancelled = ref(0)
const errors = ref<string[]>([])

/**
 * Expose the save payload plus pixel probes to the Playwright tests.
 *
 * @param result the exported image
 */
async function onSave(result: ExportResult) {
	// Stands in for a host storing the blob. The editor cannot know how
	// long that takes, so it is told: the PUT is the larger half of the
	// wait on a real instance.
	saving.value = true
	setTimeout(() => {
		saving.value = false
	}, 400)

	const bitmap = await createImageBitmap(result.blob)
	const canvas = document.createElement('canvas')
	canvas.width = bitmap.width
	canvas.height = bitmap.height
	const context = canvas.getContext('2d')!
	context.drawImage(bitmap, 0, 0)

	const probe = (x: number, y: number) => Array.from(context.getImageData(x, y, 1, 1).data)
	// Spread of the red channel over a patch: how much grain survived
	// the export, which a single pixel cannot tell
	const grain = (x: number, y: number, size: number) => {
		const { data } = context.getImageData(x, y, size, size)
		const values = Array.from({ length: size * size }, (_, index) => data[index * 4]!)
		const mean = values.reduce((sum, value) => sum + value, 0) / values.length
		return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length)
	}
	// Enough of the saved bytes to tell whether what the camera recorded
	// came through, without teaching the playground to parse EXIF
	const bytes = new Uint8Array(await result.blob.arrayBuffer())
	let text = ''
	for (const byte of bytes) {
		text += String.fromCharCode(byte)
	}
	// The same pixel read from the source, decoded the way this browser
	// decodes it. An edit that changed nothing about the colours leaves
	// the two the same, whether or not the browser colour-manages.
	const source = src.value
	let sourceCenter: number[] = []
	if (source instanceof Blob) {
		const sourceBitmap = await createImageBitmap(source)
		const sourceCanvas = document.createElement('canvas')
		sourceCanvas.width = sourceBitmap.width
		sourceCanvas.height = sourceBitmap.height
		const sourceContext = sourceCanvas.getContext('2d')!
		sourceContext.drawImage(sourceBitmap, 0, 0)
		sourceCenter = Array.from(sourceContext
			.getImageData(Math.floor(sourceBitmap.width / 2), Math.floor(sourceBitmap.height / 2), 1, 1)
			.data)
	}

	saved.value = JSON.stringify({
		size: result.blob.size,
		sourceCenter,
		// What the export was written at, read back out of its own
		// quantization table
		quality: estimateJpegQuality(bytes),
		exif: text.includes('Exif\0\0'),
		xmp: text.includes('http://ns.adobe.com/xap'),
		camera: text.includes('Test Camera 1'),
		taken: text.includes('2019:05:04 11:22:33'),
		width: result.width,
		height: result.height,
		mimeType: result.mimeType,
		topLeft: probe(0, 0),
		topRight: probe(canvas.width - 1, 0),
		bottomLeft: probe(0, canvas.height - 1),
		center: probe(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2)),
		grain: grain(20, 20, Math.min(100, canvas.width - 20, canvas.height - 20)),
	})
}

/**
 * Keep the demo alive without network access: fall back to the
 * generated fixture when the remote photo cannot load.
 *
 * @param error the load failure
 */
async function onError(error: Error) {
	errors.value.push(error.message)
	if (DEMO_PHOTOS.some((entry) => entry.src === src.value)) {
		src.value = await makeFixture()
	}
}

/**
 * Mirror every reported state change for the Playwright tests, and
 * count them so a test can tell a drag from its release.
 *
 * @param state the new edit state
 */
function onChange(state: EditorState) {
	stateJson.value = JSON.stringify(state)
	changes.value++
}
</script>

<template>
	<main class="playground">
		<ImageEditor
			v-if="src !== null"
			:src="src"
			:initialState="restored"
			:saving="saving"
			@save="onSave"
			@cancel="cancelled++"
			@error="onError"
			@change="onChange" />
		<!-- Demo page only: the test pages ask for a fixture by name, and
			a control floating over the editor would sit in their way.
			The credit rides along in the tooltip rather than taking a
			corner of the editor for itself -->
		<button
			v-if="requested === null"
			type="button"
			class="playground__shuffle"
			:title="photoHint"
			:aria-label="photoHint"
			@click="nextPhoto()">
			<ImageMultipleOutline :size="24" />
		</button>
		<!-- Observable outcomes for the Playwright tests, hidden on the
			default demo page -->
		<template v-if="requested !== null">
			<output data-test="saved">{{ saved }}</output>
			<output data-test="state">{{ stateJson }}</output>
			<output data-test="changes">{{ changes }}</output>
			<output data-test="source-size">{{ sourceSize }}</output>
			<output data-test="cancelled">{{ cancelled }}</output>
			<output data-test="errors">{{ errors.join(', ') }}</output>
		</template>
	</main>
</template>

<style scoped>
.playground {
	height: 100vh;
}

/* Test-observability overlay: must never affect the editor layout,
   moving it mid-test shifts every canvas coordinate */
output {
	position: fixed;
	inset-inline: 0;
	max-height: 24px;
	overflow: hidden;
	font-size: 9px;
	opacity: 0.4;
	pointer-events: none;
	z-index: 10;
}

/* Sits in the corner the editor leaves empty, and never over its
   chrome: the demo is the editor, not the page around it. It stands on
   the same left edge as the tool rail, 4 baselines in, and wears the
   same glass: the editor's tokens are scoped to its own root, so the
   values are repeated here rather than inherited. */
.playground__shuffle {
	position: fixed;
	inset-block-end: 16px;
	inset-inline-start: 16px;
	display: flex;
	align-items: center;
	justify-content: center;
	inline-size: 44px;
	block-size: 44px;
	padding: 0;
	border: 1px solid rgba(242, 242, 247, 0.1);
	border-radius: 20px;
	background: rgba(20, 20, 22, 0.6);
	backdrop-filter: blur(24px) saturate(1.4);
	box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
	color: #f2f2f7;
	cursor: pointer;
	z-index: 10;
}

.playground__shuffle:hover {
	background: rgba(36, 36, 40, 0.72);
}

.playground__shuffle:focus-visible {
	outline: 2px solid #f2f2f7;
	outline-offset: 2px;
}

output[data-test='saved'] { inset-block-end: 72px; }
output[data-test='state'] { inset-block-end: 48px; }
output[data-test='cancelled'] { inset-block-end: 24px; }
output[data-test='errors'] { inset-block-end: 0; }
</style>
