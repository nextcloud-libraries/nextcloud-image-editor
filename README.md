<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
# @nextcloud/image-editor

Vue 3 image editor component for Nextcloud apps. Replacement for the
unmaintained Filerobot editor.

- 📖 [API documentation](https://skjnldsv.github.io/image-editor/)
- 🎨 [Live demo](https://skjnldsv.github.io/image-editor/demo/)

## Features

- Crop with rule-of-thirds guides, aspect presets (free, original,
  1:1, 4:3, 16:9), 90° rotation, flips, fine rotation (±45°) and
  scale; the frame stays stable thanks to cover scaling
- Brightness, contrast and saturation adjustments; sixteen filter
  presets with live preview chips, from photographic grades (pop,
  golden, coast, cinema, berry, mist, warm, cool, fade) over
  monochromes (grayscale, noir, luna, sepia) to effects (invert,
  solarize, posterize)
- Annotations: freehand drawing, rectangles, ellipses, arrows, text and
  emoji stickers (the user's frequently used Nextcloud emojis plus the
  full picker): movable, resizable, rotatable, recolorable,
  duplicatable and deletable
- Redaction that destroys pixels (block averaging or strong blur),
  never just an overlay
- Full undo/redo with Ctrl+Z/Y, revert-all behind a confirmation,
  arrow-key nudging, cursor-anchored wheel zoom, drag panning, pinch
  zoom on touch and a click-to-reset zoom readout
- Ambient glass UI tinted by the image itself, responsive down to
  phone-sized containers (container queries, not viewport media queries)
- Keyboard accessible, pointer-event based canvas (mouse and touch),
  `prefers-reduced-motion` respected
- Exports a `Blob` at natural resolution in PNG, JPEG or WebP, optionally
  bounded by `maxSize`; an unedited image is handed back untouched

## Design principles

- **Maintainability first.** Konva is the only canvas dependency, pinned to a
  minor version and only bumped after a changelog review. No wrapped
  third-party editor, no framework interop layers.
- **One declarative state.** Every edit lives in a single `EditorState`;
  the Konva scene is a pure render of it, and the export runs through the
  same code path as the interactive view: what you save is what you saw.
- **The library never persists.** It accepts an image (`Blob`, `File` or URL)
  and emits an edited `Blob`. WebDAV, versioning and file naming belong to the
  consuming app.
- **Every behavior is covered by tests**: unit tests for math and state,
  Playwright tests in a real browser for everything touching canvas.

## Usage

```vue
<script setup lang="ts">
import type { ExportResult } from '@nextcloud/image-editor'
import { ImageEditor } from '@nextcloud/image-editor'

function onSave({ blob, mimeType }: ExportResult) {
	// persist the blob, e.g. via @nextcloud/upload or WebDAV PUT
}
</script>

<template>
	<ImageEditor :src="file" @save="onSave" @cancel="close" @error="showError" />
</template>
```

## API

### `<ImageEditor>`

| Prop | Type | Description |
|------|------|-------------|
| `src` | `Blob \| string` | Image to edit (Blob, File or URL). Required. |
| `label` | `string` | Accessible label of the canvas area. |
| `exportOptions` | `ExportOptions` | `format`, `quality` and `maxSize` for the save button. Defaults to PNG at natural resolution. |

| Event | Payload | Description |
|-------|---------|-------------|
| `save` | `ExportResult` | Edited image rendered at natural resolution. |
| `cancel` | – | User dismissed the editor. |
| `error` | `Error` | Loading or export failed. |
| `change` | `EditorState` | Fired when an edit is committed, e.g. for dirty tracking. A slider being dragged previews without emitting; releasing it emits once. |

Exposed methods: `exportImage(options?: ExportOptions): Promise<ExportResult>`
with `format`, `quality` and `maxSize` (longest edge bound) options.

Saving an image that was not edited hands back the source bytes
untouched, rather than re-encoding them. That keeps the file's quality
and its metadata, and it only applies when `src` was given as a `Blob`
or `File`, nothing was asked of the encoder, and the state is pristine.
`isPristine(state)` is exported for the same check, e.g. to disable a
save button.

### `useHistory<T>(capacity?)`

Linear undo/redo history of immutable snapshots, used by the editor and
exported for standalone use.

## Development

```sh
npm ci
npm run test           # unit tests (vitest)
npm run test:e2e       # Playwright tests (real browser, canvas)
npm run playground     # dev playground at http://localhost:5173
npm run lint
npm run typecheck     # vue-tsc over lib/ and __tests__/
npm run build
npm run build:doc      # typedoc API documentation
npm run build:demo     # static demo page build
```

## Testing policy

Regressions are the primary risk for a long-lived canvas library:

- Coordinate math (fit, crop, rotation/flip remapping) is implemented as
  pure functions and unit-tested exhaustively.
- Editor state (history, tool state, annotations) is unit-tested without
  a canvas.
- Rendering and interaction run as Playwright tests in a real browser
  (chromium and firefox) against the playground app, asserting exported
  pixels, not just DOM state; jsdom has no real canvas and is never used
  to test Konva code.
- New tools ship with their tests in the same pull request, no exceptions.
- Current spread: 90+ unit tests over the pure state, geometry,
  filter and interaction math; over 100 browser scenarios (twice,
  chromium and firefox) asserting exported pixels and end-to-end
  behavior.
