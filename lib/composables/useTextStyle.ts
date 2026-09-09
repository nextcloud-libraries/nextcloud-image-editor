/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { WritableComputedRef } from 'vue'
import type { EditorContext } from '../editor/context.ts'
import type { FontId } from '../editor/fonts.ts'
import type { TextAlign } from '../editor/text-align.ts'

import { computed } from 'vue'
import { t } from '../utils/l10n.ts'

/** The text styling switches, as the panel binds them */
export interface TextStyle {
	outline: WritableComputedRef<boolean>
	background: WritableComputedRef<boolean>
	font: WritableComputedRef<FontId>
	align: WritableComputedRef<TextAlign>
	bold: WritableComputedRef<boolean>
	italic: WritableComputedRef<boolean>
	underline: WritableComputedRef<boolean>
	strikethrough: WritableComputedRef<boolean>
}

/** The boolean switches, each with the context field holding its default */
const SWITCH_DEFAULTS = {
	outline: 'textOutline',
	background: 'textBackground',
	bold: 'textBold',
	italic: 'textItalic',
	underline: 'textUnderline',
	strikethrough: 'textStrikethrough',
} as const

type Switch = keyof typeof SWITCH_DEFAULTS

/**
 * The switches that decide how text is drawn, over the selection when
 * there is one and over the next annotation otherwise.
 *
 * Reading them from the selection is what makes them controls rather
 * than defaults: someone who has just placed a caption and finds it
 * unreadable expects the switch to fix that caption, not to arm the one
 * after it. With nothing selected they are still the default for what
 * comes next, which is how the colour and the font size already behave.
 *
 * @param context the editor context
 */
export function useTextStyle(context: EditorContext): TextStyle {
	/** The selected annotation, when it is text whose styling is ours to change */
	function styleable() {
		const annotation = context.state.value.annotations
			.find((entry) => entry.id === context.selectedId.value)
		// A sticker is an emoji glyph: an edge or a plate around it is not
		// what anyone means by styling text
		return annotation?.type === 'text' ? annotation : undefined
	}

	/**
	 * Bind one switch to the selection, falling back to the tool default.
	 *
	 * @param key the annotation field the switch writes
	 * @param label what the step is called in the history
	 */
	function toggle(key: Switch, label: string) {
		const fallback = SWITCH_DEFAULTS[key]
		return computed({
			get(): boolean {
				return styleable()?.[key] ?? context[fallback].value
			},
			set(value: boolean) {
				context[fallback].value = value
				const annotation = styleable()
				if (annotation === undefined) {
					return
				}
				const state = context.state.value
				context.commit({
					...state,
					annotations: state.annotations
						.map((entry) => entry.id === annotation.id ? { ...entry, [key]: value } : entry),
				}, label)
			},
		})
	}

	/**
	 * Bind one pick-one-of-several control the same way the switches are
	 * bound, skipping the commit when the selection already has the value
	 * so reselecting it does not fill the history with no-ops.
	 *
	 * @param key the annotation field the control writes
	 * @param fallback where the default for new text is kept
	 * @param label what the step is called in the history
	 */
	function choice<T extends FontId | TextAlign>(
		key: 'font' | 'align',
		fallback: 'textFont' | 'textAlign',
		label: string,
	) {
		return computed({
			get(): T {
				return (styleable()?.[key] ?? context[fallback].value) as T
			},
			set(value: T) {
				context[fallback].value = value as FontId & TextAlign
				const annotation = styleable()
				if (annotation === undefined || annotation[key] === value) {
					return
				}
				const state = context.state.value
				context.commit({
					...state,
					annotations: state.annotations
						.map((entry) => entry.id === annotation.id ? { ...entry, [key]: value } : entry),
				}, label)
			},
		})
	}

	return {
		outline: toggle('outline', t('Outline')),
		background: toggle('background', t('Background')),
		font: choice<FontId>('font', 'textFont', t('Font')),
		align: choice<TextAlign>('align', 'textAlign', t('Alignment')),
		bold: toggle('bold', t('Bold')),
		italic: toggle('italic', t('Italic')),
		underline: toggle('underline', t('Underline')),
		strikethrough: toggle('strikethrough', t('Strikethrough')),
	}
}
