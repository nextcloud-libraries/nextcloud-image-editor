/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
	root: import.meta.dirname,
	plugins: [vue()],
	define: {
		// No bundled translations while serving the playground
		__TRANSLATIONS__: '[]',
	},
})
