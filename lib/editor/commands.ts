/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { InjectionKey } from 'vue'

import { inject, provide } from 'vue'

/**
 * Imperative editor commands. State-reading controls talk to the
 * context directly; operations that need the host component's stage
 * (orientation size, transitions, the live crop overlay) go through
 * this command surface instead of bubbling event chains.
 */
export interface EditorCommands {
	rotateCW(): void
	rotateCCW(): void
	flipHorizontal(): void
	flipVertical(): void
	/** Apply the live crop overlay's rectangle */
	applyCrop(): void
	/** Drop the crop entirely */
	resetCrop(): void
	/** Revert every edit as one undoable step */
	revert(): void
}

const EDITOR_COMMANDS: InjectionKey<EditorCommands> = Symbol('nextcloud:image-editor:commands')

/**
 * Provide the command surface to descendant panels.
 *
 * @param commands the host component's implementations
 */
export function provideEditorCommands(commands: EditorCommands): EditorCommands {
	provide(EDITOR_COMMANDS, commands)
	return commands
}

/**
 * Access the command surface provided by the ImageEditor root.
 */
export function useEditorCommands(): EditorCommands {
	const commands = inject(EDITOR_COMMANDS, null)
	if (commands === null) {
		throw new Error('useEditorCommands() called outside of an ImageEditor tree')
	}
	return commands
}
