/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
	testDir: './e2e',
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	// Shards emit blob reports on CI, merged into one HTML report by the
	// merge-reports workflow job
	reporter: process.env.CI ? 'blob' : 'list',
	use: {
		baseURL: 'http://127.0.0.1:5173',
		trace: 'on-first-retry',
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
		{
			name: 'firefox',
			use: { ...devices['Desktop Firefox'] },
		},
	],
	webServer: {
		command: 'npm run playground -- --port 5173 --strictPort --host 127.0.0.1',
		url: 'http://127.0.0.1:5173',
		reuseExistingServer: !process.env.CI,
	},
})
