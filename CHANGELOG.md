<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
# Changelog

## 0.1.0 – unreleased

### Added

- Initial scaffold: `ImageEditor` component rendering a Konva stage with
  Blob export, `useHistory` undo/redo composable, vitest unit tests and
  Playwright browser tests with a dev playground.
- Editing tools: crop, rotate, flip, brightness/contrast/saturation,
  grayscale and sepia presets, freehand drawing, shapes, arrows, text and
  sticker annotations with selection, transform and full undo/redo.
- API documentation (typedoc) and a static demo page deployed to
  GitHub Pages.
- Ambient glass redesign: image-tinted chrome, floating tool rail,
  bottom control card and filter preview strip; keyboard shortcuts,
  view zoom/pan and a responsive layout driven by container queries.
- Redact tool (pixelate or blur), fine rotation and scale, extended
  filter presets with live previews.
- Crop aspect presets, true rotation for rectangles and ellipses,
  eleven filter presets, a dedicated select mode, frequently-used
  emoji stickers with the full picker, an auto-growing text overlay,
  and a full-window layout down to phone-sized containers.
- Pinch zoom on touch devices; Escape leaves the crop mode without
  applying.
- Internals: per-mode panel components, text-editing and export
  composables, pure and unit-tested crop clamping, transform folding
  and pointer-tool state machines.
