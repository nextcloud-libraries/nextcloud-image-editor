/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { createApp } from 'vue'
import App from './App.vue'
import LocalFileDemo from './LocalFileDemo.vue'

import './style.css'

// ?demo=local-file shows the editor the way a host editing a local file
// would use it; everything else is the demo and test page
const demo = new URLSearchParams(window.location.search).get('demo')
createApp(demo === 'local-file' ? LocalFileDemo : App).mount('#app')
