/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * A unique id for an annotation.
 *
 * crypto.randomUUID is only exposed in a secure context, and a
 * Nextcloud instance served over plain HTTP on a local network is not
 * one. There it is undefined, and calling it threw on every annotation
 * the user tried to create. crypto.getRandomValues has no such
 * restriction, so it carries the fallback.
 */
export function newId(): string {
	if (typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID()
	}
	return [...crypto.getRandomValues(new Uint8Array(16))]
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('')
}
