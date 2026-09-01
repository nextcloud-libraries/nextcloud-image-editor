/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * The Nextcloud primary color of the active theme, for canvas chrome
 * that cannot use CSS variables directly.
 */
export function primaryColor(): string {
	const value = getComputedStyle(document.body).getPropertyValue('--color-primary-element').trim()
	return value !== '' ? value : '#0082c9'
}
