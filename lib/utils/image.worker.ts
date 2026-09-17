/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/** What the editor asks the worker to do */
export type ImageWorkerRequest
	= | { id: number, kind: 'decode', blob: Blob }
		| { id: number, kind: 'levels', bitmap: ImageBitmap, steps: number }

/** What comes back, one message per request */
export type ImageWorkerResponse
	= | { id: number, kind: 'decode', bitmap: ImageBitmap }
		| { id: number, kind: 'levels', levels: ImageBitmap[] }
		| { id: number, kind: 'error', message: string }

/**
 * Draw a bitmap at half its size.
 *
 * @param source the bitmap to shrink
 */
function halve(source: ImageBitmap): ImageBitmap {
	const canvas = new OffscreenCanvas(
		Math.max(1, Math.ceil(source.width / 2)),
		Math.max(1, Math.ceil(source.height / 2)),
	)
	const context = canvas.getContext('2d')
	if (context === null) {
		throw new Error('Canvas 2D context unavailable')
	}
	context.imageSmoothingQuality = 'high'
	context.drawImage(source, 0, 0, canvas.width, canvas.height)
	return canvas.transferToImageBitmap()
}

self.addEventListener('message', async (event: MessageEvent<ImageWorkerRequest>) => {
	const request = event.data
	try {
		if (request.kind === 'decode') {
			const bitmap = await createImageBitmap(request.blob)
			const response: ImageWorkerResponse = { id: request.id, kind: 'decode', bitmap }
			self.postMessage(response, { transfer: [bitmap] })
			return
		}
		let level = request.bitmap
		const levels: ImageBitmap[] = []
		for (let step = 0; step < request.steps && (level.width > 1 || level.height > 1); step++) {
			level = halve(level)
			levels.push(level)
		}
		// The source bitmap was transferred in and is ours to release
		request.bitmap.close()
		const response: ImageWorkerResponse = { id: request.id, kind: 'levels', levels }
		self.postMessage(response, { transfer: levels })
	} catch (error) {
		const response: ImageWorkerResponse = {
			id: request.id,
			kind: 'error',
			message: error instanceof Error ? error.message : String(error),
		}
		self.postMessage(response)
	}
})
