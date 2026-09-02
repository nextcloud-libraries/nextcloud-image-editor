/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/** Controls that consume typing, so editor shortcuts must stay out */
const TEXT_ENTRY = 'input, textarea, select, [contenteditable]'

/** Controls the space bar activates, so it cannot double as a modifier */
const ACTIVATABLE = 'button, [role="button"], a[href], summary'

/**
 * Whether the event target is a control that owns text input.
 *
 * @param target the event target
 */
export function ownsTextEntry(target: EventTarget | null): boolean {
	return target instanceof HTMLElement && target.closest(TEXT_ENTRY) !== null
}

/**
 * Whether the event target is a control the space bar belongs to,
 * either because it takes text or because space activates it.
 *
 * @param target the event target
 */
export function ownsSpaceKey(target: EventTarget | null): boolean {
	return target instanceof HTMLElement
		&& target.closest(`${TEXT_ENTRY}, ${ACTIVATABLE}`) !== null
}
