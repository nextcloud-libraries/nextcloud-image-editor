/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/// <reference types="vite/client" />

declare module '*.vue' {
	import type { DefineComponent } from 'vue'

	const component: DefineComponent<object, object, unknown>
	export default component
}
