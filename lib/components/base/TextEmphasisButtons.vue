<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Component } from 'vue'
import type { TextEmphasis } from '../../editor/text-emphasis.ts'

import NcButton from '@nextcloud/vue/components/NcButton'
import FormatBold from 'vue-material-design-icons/FormatBold.vue'
import FormatItalic from 'vue-material-design-icons/FormatItalic.vue'
import FormatStrikethrough from 'vue-material-design-icons/FormatStrikethrough.vue'
import FormatUnderline from 'vue-material-design-icons/FormatUnderline.vue'
import { useTextStyle } from '../../composables/useTextStyle.ts'
import { useEditorContext } from '../../editor/context.ts'
import { TEXT_EMPHASES } from '../../editor/text-emphasis.ts'
import { t } from '../../utils/l10n.ts'

defineProps<{
	/** Prefix for the data-test hooks, one per surface the row appears on */
	testPrefix: string
	/** Icon size, matching the other buttons on the same surface */
	size: number
}>()

// Bound to the selected caption when there is one, to the next one
// otherwise, the same way the other text switches around these behave
const textStyle = useTextStyle(useEditorContext())

const META: Record<TextEmphasis, { label: string, icon: Component }> = {
	bold: { label: t('Bold'), icon: FormatBold },
	italic: { label: t('Italic'), icon: FormatItalic },
	underline: { label: t('Underline'), icon: FormatUnderline },
	strikethrough: { label: t('Strikethrough'), icon: FormatStrikethrough },
}

const emphases = TEXT_EMPHASES.map((id) => ({ id, ...META[id] }))
</script>

<template>
	<NcButton
		v-for="entry in emphases"
		:key="entry.id"
		:aria-label="entry.label"
		:title="entry.label"
		:pressed="textStyle[entry.id].value"
		variant="tertiary"
		:data-test="`${testPrefix}-${entry.id}`"
		@click="textStyle[entry.id].value = !textStyle[entry.id].value">
		<template #icon>
			<component :is="entry.icon" :size="size" />
		</template>
	</NcButton>
</template>
