<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
# @nextcloud/image-editor

Vue 3 image editor component for Nextcloud apps. Replacement for the
unmaintained Filerobot editor.

> **Status: early development.** The current scaffold renders an image on a
> Konva stage and exports it back as a Blob. Editing tools land as separate,
> individually reviewed pull requests: see the roadmap below.

## Design principles

- **Maintainability first.** Konva is the only canvas dependency, pinned to a
  minor version and only bumped after a changelog review. No wrapped
  third-party editor, no framework interop layers.
- **The library never persists.** It accepts an image (`Blob`, `File` or URL)
  and emits an edited `Blob`. WebDAV, versioning and file naming belong to the
  consuming app.
- **Accessible and touch-capable from day one**, not backfilled.
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

| Event | Payload | Description |
|-------|---------|-------------|
| `save` | `ExportResult` | Edited image exported at natural resolution. |
| `cancel` | – | User dismissed the editor. |
| `error` | `Error` | Loading or export failed. |

Exposed methods: `exportImage(options?: ExportOptions): Promise<ExportResult>`.

### `useHistory<T>(capacity?)`

Linear undo/redo history of immutable snapshots, used by the editing tools.

## Development

```sh
npm ci
npm run test           # unit tests (vitest)
npm run test:e2e       # Playwright tests (real browser, canvas)
npm run playground     # dev playground at http://localhost:5173
npm run lint
npm run build
```

## Roadmap

1. Crop / rotate / flip / resize
2. Brightness / contrast / saturation / exposure, filter presets
3. Annotations: freehand drawing, text, shapes, stickers
4. Files app integration (separate repository)

## Testing policy

Regressions are the primary risk for a long-lived canvas library:

- Coordinate math (`fitContain`, crop/rotate transforms) is implemented as
  pure functions and unit-tested exhaustively.
- Editor state (history, tool state) is unit-tested without a canvas.
- Rendering and interaction run as Playwright tests in a real browser against
  the playground app; jsdom has no real canvas and is never used to test
  Konva code.
- New tools ship with their tests in the same pull request, no exceptions.
