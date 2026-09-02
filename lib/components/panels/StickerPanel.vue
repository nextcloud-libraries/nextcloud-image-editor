<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { emojiSearch } from '@nextcloud/vue/functions/emoji'
import { computed } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcEmojiPicker from '@nextcloud/vue/components/NcEmojiPicker'
import { useEditorContext } from '../../editor/context.ts'
import { t } from '../../utils/l10n.ts'

defineProps<{
	/** Whether an image is loaded and the tools are usable */
	loaded: boolean
}>()

const context = useEditorContext()

const moreLabel = t('More emojis')

const FALLBACK_STICKERS = ['😀', '😍', '🎉', '👍', '❤️', '⭐', '🔥', '💡', '✅', '❌', '❓', '⚠️']

/**
 * The user's frequently used emojis, falling back to a curated set
 * when there is no usage history yet.
 */
function frequentStickers(): string[] {
	try {
		const frequent = emojiSearch('', 12)
			.map((emoji) => (emoji as { native?: string }).native)
			.filter((native): native is string => typeof native === 'string' && native !== '')
		return frequent.length >= 6 ? frequent : FALLBACK_STICKERS
	} catch {
		return FALLBACK_STICKERS
	}
}

const DEFAULT_STICKERS = frequentStickers()

// The picked emoji joins the quick row when it came from the picker
const stickers = computed(() => DEFAULT_STICKERS.includes(context.sticker.value)
	? DEFAULT_STICKERS
	: [context.sticker.value, ...DEFAULT_STICKERS.slice(0, 11)])
</script>

<template>
	<div class="sticker-panel">
		<NcButton
			v-for="sticker in stickers"
			:key="sticker"
			:aria-label="sticker"
			:pressed="context.sticker.value === sticker"
			:disabled="!loaded"
			class="sticker-panel__emoji"
			variant="tertiary"
			@click="context.sticker.value = sticker">
			{{ sticker }}
		</NcButton>
		<NcEmojiPicker @select="context.sticker.value = $event">
			<NcButton data-test="emoji-picker" variant="tertiary">
				{{ moreLabel }}
			</NcButton>
		</NcEmojiPicker>
	</div>
</template>

<style scoped lang="scss">
.sticker-panel {
	display: flex;
	align-items: center;
	justify-content: center;
	flex-wrap: wrap;
	gap: calc(var(--default-grid-baseline) * 2);

	// The emoji is the button's label, so it inherits the editor's small
	// chrome font and leaves the target too short to hit. Size the glyph
	// to fill the pointer target instead.
	:deep(.sticker-panel__emoji) {
		min-height: var(--default-clickable-area, 44px);
		font-size: 22px;
		line-height: 1;
	}
}
</style>
