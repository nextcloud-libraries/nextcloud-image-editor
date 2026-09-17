<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
defineProps<{
	/** Surface shape: rounded card, capsule pill or compact strip */
	variant?: 'card' | 'pill' | 'strip'
	/**
	 * Back the surface more heavily, for chrome whose text has to hold
	 * its contrast over any picture.
	 */
	opaque?: boolean
}>()
</script>

<template>
	<div
		class="glass-surface"
		:class="[`glass-surface--${variant ?? 'card'}`, { 'glass-surface--opaque': opaque }]">
		<slot />
	</div>
</template>

<style scoped lang="scss">
.glass-surface {
	background: var(--editor-glass);
	backdrop-filter: blur(24px) saturate(1.4);
	border: 1px solid var(--color-border);
	box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);

	&--opaque {
		background: var(--editor-glass-opaque);
	}

	&--card {
		border-radius: 20px;
	}

	&--strip {
		border-radius: 16px;
	}

	&--pill {
		border-radius: var(--border-radius-pill, 100px);
	}
}
</style>
