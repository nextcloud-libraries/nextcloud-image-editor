/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Component } from 'vue'

import ArrowExpand from 'vue-material-design-icons/ArrowExpand.vue'
import ArrowTopRight from 'vue-material-design-icons/ArrowTopRight.vue'
import Blur from 'vue-material-design-icons/Blur.vue'
import BorderOutside from 'vue-material-design-icons/BorderOutside.vue'
import BoxShadow from 'vue-material-design-icons/BoxShadow.vue'
import CameraIris from 'vue-material-design-icons/CameraIris.vue'
import CircleOpacity from 'vue-material-design-icons/CircleOpacity.vue'
import ContentCopy from 'vue-material-design-icons/ContentCopy.vue'
import ContrastCircle from 'vue-material-design-icons/ContrastCircle.vue'
import Crop from 'vue-material-design-icons/Crop.vue'
import CropFree from 'vue-material-design-icons/CropFree.vue'
import CursorMove from 'vue-material-design-icons/CursorMove.vue'
import Delete from 'vue-material-design-icons/Delete.vue'
import EllipseOutline from 'vue-material-design-icons/EllipseOutline.vue'
import FlipHorizontal from 'vue-material-design-icons/FlipHorizontal.vue'
import FlipVertical from 'vue-material-design-icons/FlipVertical.vue'
import FormatAlignLeft from 'vue-material-design-icons/FormatAlignLeft.vue'
import FormatBold from 'vue-material-design-icons/FormatBold.vue'
import FormatColorHighlight from 'vue-material-design-icons/FormatColorHighlight.vue'
import FormatFont from 'vue-material-design-icons/FormatFont.vue'
import FormatItalic from 'vue-material-design-icons/FormatItalic.vue'
import FormatStrikethrough from 'vue-material-design-icons/FormatStrikethrough.vue'
import FormatText from 'vue-material-design-icons/FormatText.vue'
import FormatUnderline from 'vue-material-design-icons/FormatUnderline.vue'
import ImageFilterCenterFocus from 'vue-material-design-icons/ImageFilterCenterFocus.vue'
import ImageOutline from 'vue-material-design-icons/ImageOutline.vue'
import InvertColors from 'vue-material-design-icons/InvertColors.vue'
import Palette from 'vue-material-design-icons/Palette.vue'
import PaletteOutline from 'vue-material-design-icons/PaletteOutline.vue'
import Pencil from 'vue-material-design-icons/Pencil.vue'
import RectangleOutline from 'vue-material-design-icons/RectangleOutline.vue'
import Restore from 'vue-material-design-icons/Restore.vue'
import RotateLeft from 'vue-material-design-icons/RotateLeft.vue'
import RotateRight from 'vue-material-design-icons/RotateRight.vue'
import Spotlight from 'vue-material-design-icons/Spotlight.vue'
import StickerEmoji from 'vue-material-design-icons/StickerEmoji.vue'
import Thermometer from 'vue-material-design-icons/Thermometer.vue'
import Tune from 'vue-material-design-icons/Tune.vue'
import VectorLine from 'vue-material-design-icons/VectorLine.vue'
import WhiteBalanceIridescent from 'vue-material-design-icons/WhiteBalanceIridescent.vue'
import WhiteBalanceSunny from 'vue-material-design-icons/WhiteBalanceSunny.vue'
import { t } from '../utils/l10n.ts'

/**
 * Icon of every step the editor records, looked up by the label the
 * step was recorded under.
 *
 * A history entry carries the translated name of what the user did,
 * which is what the list reads out. Keying the icons off that name
 * keeps the twenty-odd call sites that record a step free of icon
 * imports, at the price of an entry falling back to no icon where a
 * label is renamed here alone. The e2e suite walks the list to catch
 * that.
 */
const ICONS = new Map<string, Component>([
	[t('Original'), ImageOutline],
	[t('Restored'), ImageOutline],
	[t('Revert all changes'), Restore],

	[t('Crop'), Crop],
	[t('Reset crop'), CropFree],
	[t('Rotate left'), RotateLeft],
	[t('Rotate right'), RotateRight],
	[t('Flip horizontal'), FlipHorizontal],
	[t('Flip vertical'), FlipVertical],
	[t('Rotation'), RotateRight],
	[t('Scale'), ArrowExpand],

	[t('Exposure'), CameraIris],
	[t('Brightness'), WhiteBalanceSunny],
	[t('Contrast'), ContrastCircle],
	[t('Saturation'), InvertColors],
	[t('Temperature'), Thermometer],
	[t('Tint'), WhiteBalanceIridescent],
	[t('Sharpen'), ImageFilterCenterFocus],
	[t('Highlights'), Spotlight],
	[t('Shadows'), BoxShadow],
	[t('Vignette'), CircleOpacity],

	[t('Draw'), Pencil],
	[t('Rectangle'), RectangleOutline],
	[t('Ellipse'), EllipseOutline],
	[t('Arrow'), ArrowTopRight],
	[t('Line'), VectorLine],
	[t('Text'), FormatText],
	[t('Sticker'), StickerEmoji],
	[t('Blur'), Blur],
	[t('Color'), Palette],
	[t('Duplicate'), ContentCopy],
	[t('Delete'), Delete],
	[t('Move or resize'), CursorMove],

	[t('Bold'), FormatBold],
	[t('Italic'), FormatItalic],
	[t('Underline'), FormatUnderline],
	[t('Strikethrough'), FormatStrikethrough],
	[t('Outline'), BorderOutside],
	[t('Background'), FormatColorHighlight],
	[t('Font'), FormatFont],
	[t('Alignment'), FormatAlignLeft],

	// Every filter preset is recorded under its own name
	[t('No filter'), PaletteOutline],
	[t('Pop'), PaletteOutline],
	[t('Golden'), PaletteOutline],
	[t('Coast'), PaletteOutline],
	[t('Cinema'), PaletteOutline],
	[t('Berry'), PaletteOutline],
	[t('Mist'), PaletteOutline],
	[t('Warm'), PaletteOutline],
	[t('Cool'), PaletteOutline],
	[t('Fade'), PaletteOutline],
	[t('Grayscale'), PaletteOutline],
	[t('Noir'), PaletteOutline],
	[t('Luna'), PaletteOutline],
	[t('Sepia'), PaletteOutline],
	[t('Invert'), PaletteOutline],
	[t('Solarize'), PaletteOutline],
	[t('Posterize'), PaletteOutline],

	[t('Edit'), Tune],
])

/**
 * The icon of a history step, or the generic one where the step was
 * recorded under a name this list does not know.
 *
 * @param label the translated name the step was recorded under
 */
export function historyIcon(label: string): Component {
	return ICONS.get(label) ?? Tune
}

/** Every label the icon list knows, for the tests that walk it */
export const HISTORY_ICON_LABELS = [...ICONS.keys()]
