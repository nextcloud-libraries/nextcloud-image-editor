<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
# Changelog

## 1.0.0-beta.1 – 2026-09-02

First release. A Vue 3 image editor component for Nextcloud apps,
replacing the unmaintained Filerobot editor. It takes an image and
emits an edited one; storing the result is the consuming app's job.

The public API is what 1.0.0 will freeze, so this beta is the moment to
say so if something in it is wrong for you.

### Transform and crop

- Crop with rule-of-thirds guides and aspect presets: free, original,
  1:1, 4:3, 16:9
- Rotation in quarter turns, horizontal and vertical flips
- Fine rotation between -45 and 45 degrees, and a scale up to 3x, both
  cover-scaled so the frame never shows a corner of empty space

### Colour

- Brightness, contrast and saturation
- Sixteen filter presets with live preview chips, from photographic
  grades (pop, golden, coast, cinema, berry, mist, warm, cool, fade)
  through monochromes (grayscale, noir, luna, sepia) to effects
  (invert, solarize, posterize)

### Annotations

- Freehand drawing, rectangles, ellipses, arrows, text, and emoji
  stickers drawn from the user's frequently used Nextcloud emojis or
  the full picker
- Select to move, resize, rotate, recolour, duplicate or delete, with
  arrow-key nudging and a floating toolbar on the selection
- Colour, stroke width and font size controls, the latter two showing
  the mark at the size it will actually be drawn

### Redaction

- Pixelation or a strong blur, both destroying the pixels in the export
  rather than covering them
- Where the browser cannot blur on a canvas, as WebKit could not before
  Safari 18, the style degrades to pixelation rather than silently
  leaving the region readable

### History

- Undo and redo, with Ctrl+Z and Ctrl+Y or Ctrl+Shift+Z
- A named history list to jump straight back to any recorded step
- Revert everything, behind a confirmation, as one undoable step

### View

- Wheel zoom anchored on the cursor, with the step following the wheel's
  travel so a mouse and a trackpad both feel right
- Panning on the middle button, a held space bar, a two-finger drag, or
  a plain drag in the modes where no tool owns one
- Pinch zoom on touch, and a zoom readout that resets the view

### Export and session

- Exports a `Blob` at natural resolution as PNG, JPEG or WebP, with
  optional quality and a bound on the longest edge
- An image that was not edited is handed back untouched, keeping its
  quality and metadata instead of being re-encoded
- `change` reports every committed edit, `initialState` takes one back,
  so an interrupted session can be resumed
- `isPristine()` and `createInitialState()` are exported for dirty
  checks, and `useHistory()` for standalone use

### Interface

- Ambient glass chrome tinted by the image itself, with a blurred copy
  of it as the backdrop
- Responsive through container queries rather than viewport media
  queries, so it adapts to the space the host gives it, down to
  phone-sized
- Every control at or above the minimum pointer target, screen-reader
  announcements for changes with no visible text, and
  `prefers-reduced-motion` respected

### Under the hood

- Konva is the only canvas dependency. No wrapped third-party editor.
- One declarative `EditorState`; the scene is a render of it, and the
  export runs through the same code path as the interactive view, so
  what you save is what you saw
- 212 unit tests over the state, geometry, filter and interaction
  math, and 86 browser scenarios run in Chromium and Firefox that
  assert exported pixels rather than DOM state
- Typechecked in CI

### Known limitations

- No translations yet: the Transifex resource behind `l10n/` is not set
  up, so every string falls back to English
- Images beyond roughly 16 megapixels can exceed the browser's canvas
  limits and export blank, on iOS in particular (#1)
- Annotations cannot be created from the keyboard alone, and the
  editor's shortcuts are bound to the window rather than to itself
- The editing tools an image editor is eventually expected to have are
  not all here yet: no line tool, eraser, multi-select or per-annotation
  opacity, and no exposure or temperature adjustment (#2)
- The package has to be bundled: its entries import their own
  stylesheet, so a plain Node process cannot load them, and
  server-side rendering is out (#5)
