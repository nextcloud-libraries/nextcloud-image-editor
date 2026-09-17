import type { WorkerLike } from '../lib/utils/image-worker.ts'
/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { ImageWorkerRequest, ImageWorkerResponse } from '../lib/utils/image.worker.ts'

import { describe, expect, it, vi } from 'vitest'
import { createImageWorkerClient } from '../lib/utils/image-worker.ts'

/**
 * A worker that answers whatever the test tells it to, so the protocol
 * can be driven without a browser behind it.
 *
 * @param answer what to reply with, given the request
 */
function fakeWorker(answer?: (request: ImageWorkerRequest) => ImageWorkerResponse) {
	const listeners: ((event: MessageEvent<ImageWorkerResponse>) => void)[] = []
	const failures: (() => void)[] = []
	const sent: ImageWorkerRequest[] = []
	const transferred: Transferable[][] = []
	const worker: WorkerLike = {
		postMessage(message, transfer) {
			sent.push(message)
			transferred.push(transfer ?? [])
			if (answer === undefined) {
				return
			}
			// A real worker answers on a later task, never inline
			queueMicrotask(() => {
				const event = { data: answer(message) } as MessageEvent<ImageWorkerResponse>
				listeners.forEach((listener) => listener(event))
			})
		},
		addEventListener(type: 'message' | 'error' | 'messageerror', listener: never) {
			if (type === 'message') {
				listeners.push(listener)
			} else {
				failures.push(listener)
			}
		},
		terminate: vi.fn(),
	}
	/** Whatever a worker a policy refused would do: an error, no answer */
	const breaks = () => failures.forEach((listener) => listener())
	return { worker, sent, transferred, breaks }
}

describe('createImageWorkerClient', () => {
	it('resolves a decode with the bitmap that came back', async () => {
		const bitmap = { width: 4, height: 2 } as ImageBitmap
		const { worker, sent } = fakeWorker((request) => ({ id: request.id, kind: 'decode', bitmap }))
		const blob = new Blob(['bytes'], { type: 'image/jpeg' })

		await expect(createImageWorkerClient(worker).decode(blob)).resolves.toBe(bitmap)
		expect(sent[0]).toMatchObject({ kind: 'decode', blob })
	})

	it('hands the bitmap over rather than copying it', async () => {
		const bitmap = { width: 8, height: 8 } as ImageBitmap
		const { worker, transferred } = fakeWorker((request) => ({ id: request.id, kind: 'levels', levels: [] }))

		await createImageWorkerClient(worker).levels(bitmap, 4)
		// Copying a 12 Mpx bitmap per request would cost what the worker saves
		expect(transferred[0]).toEqual([bitmap])
	})

	it('answers each request with its own reply', async () => {
		const first = { width: 1, height: 1 } as ImageBitmap
		const second = { width: 2, height: 2 } as ImageBitmap
		const { worker } = fakeWorker((request) => ({
			id: request.id,
			kind: 'decode',
			bitmap: request.id === 0 ? first : second,
		}))
		const client = createImageWorkerClient(worker)

		// Two in flight at once: the id is what tells the answers apart
		const both = await Promise.all([
			client.decode(new Blob(['a'])),
			client.decode(new Blob(['b'])),
		])
		expect(both).toEqual([first, second])
	})

	it('rejects when the worker reports a failure', async () => {
		const { worker } = fakeWorker((request) => ({ id: request.id, kind: 'error', message: 'no decoder' }))

		await expect(createImageWorkerClient(worker).decode(new Blob(['x']))).rejects.toThrow('no decoder')
	})

	it('gives up on everything in flight when the worker errors', async () => {
		const { worker, breaks } = fakeWorker()
		const client = createImageWorkerClient(worker)
		const waiting = client.decode(new Blob(['x']))

		// A worker a content security policy refuses never answers, and a
		// request left unsettled would hang the image it was loading
		breaks()
		await expect(waiting).rejects.toThrow('stopped')
	})

	it('refuses later requests rather than leaving them hanging', async () => {
		const { worker, breaks } = fakeWorker()
		const client = createImageWorkerClient(worker)
		breaks()

		await expect(client.decode(new Blob(['x']))).rejects.toThrow('stopped')
	})
})
