/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { ImageWorkerRequest, ImageWorkerResponse } from './image.worker.ts'

import ImageWorker from './image.worker.ts?worker&inline'

/** The subset of Worker this client drives, so a test can stand in for one */
export interface WorkerLike {
	postMessage(message: ImageWorkerRequest, transfer?: Transferable[]): void
	addEventListener(type: 'message', listener: (event: MessageEvent<ImageWorkerResponse>) => void): void
	addEventListener(type: 'error' | 'messageerror', listener: () => void): void
	terminate(): void
}

/** A request before the client stamps an id on it */
type Unidentified<T> = T extends { id: number } ? Omit<T, 'id'> : never

export interface ImageWorkerClient {
	/** Decode encoded bytes into a bitmap, off the main thread */
	decode(blob: Blob): Promise<ImageBitmap>
	/**
	 * Half-size copies of a bitmap, smallest last. The bitmap is
	 * transferred to the worker and is unusable here afterwards.
	 */
	levels(bitmap: ImageBitmap, steps: number): Promise<ImageBitmap[]>
}

/**
 * Talk to an image worker, one promise per request.
 *
 * @param worker the worker to drive
 */
export function createImageWorkerClient(worker: WorkerLike): ImageWorkerClient {
	const pending = new Map<number, { resolve: (value: never) => void, reject: (error: Error) => void }>()
	let nextId = 0
	let broken = false

	/**
	 * Give up on the worker and on everything waiting for it.
	 *
	 * A worker a content security policy refuses does not throw where it
	 * was created: the constructor returns and an error event arrives
	 * later. Without this the promises from every request it never got
	 * would stay unsettled, and the editor would wait on an image that
	 * is never coming.
	 */
	function fail(): void {
		broken = true
		const waiting = [...pending.values()]
		pending.clear()
		waiting.forEach((one) => one.reject(new Error('The image worker stopped')))
	}

	worker.addEventListener('error', fail)
	worker.addEventListener('messageerror', fail)

	worker.addEventListener('message', (event) => {
		const response = event.data
		const waiting = pending.get(response.id)
		if (waiting === undefined) {
			return
		}
		pending.delete(response.id)
		if (response.kind === 'error') {
			waiting.reject(new Error(response.message))
			return
		}
		waiting.resolve((response.kind === 'decode' ? response.bitmap : response.levels) as never)
	})

	/**
	 * Send one request and wait for the answer that carries its id.
	 *
	 * @param request what to ask, without the id
	 * @param transfer what to hand over rather than copy
	 */
	function ask<T>(request: Unidentified<ImageWorkerRequest>, transfer: Transferable[]): Promise<T> {
		if (broken) {
			return Promise.reject(new Error('The image worker stopped'))
		}
		const id = nextId++
		return new Promise<T>((resolve, reject) => {
			pending.set(id, { resolve: resolve as (value: never) => void, reject })
			worker.postMessage({ ...request, id } as ImageWorkerRequest, transfer)
		})
	}

	return {
		decode: (blob) => ask<ImageBitmap>({ kind: 'decode', blob }, []),
		levels: (bitmap, steps) => ask<ImageBitmap[]>({ kind: 'levels', bitmap, steps }, [bitmap]),
	}
}

/** The one worker the editor uses, or null where it cannot have one */
let client: ImageWorkerClient | null | undefined

/**
 * The shared image worker, or null where this browser will not give us
 * one: OffscreenCanvas is missing, or a content security policy refuses
 * the blob the worker is built from. Every caller has a path that does
 * the same work on the main thread, which is what those browsers get.
 */
export function imageWorker(): ImageWorkerClient | null {
	if (client !== undefined) {
		return client
	}
	client = null
	if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') {
		return client
	}
	try {
		client = createImageWorkerClient(new ImageWorker() as unknown as WorkerLike)
	} catch {
		client = null
	}
	return client
}

/**
 * Forget the shared worker. Test seam only.
 */
export function resetImageWorker(): void {
	client = undefined
}
