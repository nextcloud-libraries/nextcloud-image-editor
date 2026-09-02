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
- View gestures: the wheel zooms at the cursor with the factor
  following its travel, and panning is on the middle button, a held
  space bar, a two-finger drag and a plain drag where no tool owns one.
- A named history list to jump back to any recorded step, an
  `initialState` prop to resume an unfinished edit, and `reset()`
  exposed alongside `exportImage()`.
- An `exportOptions` prop choosing the save format, quality and size
  bound; an unedited image is handed back untouched instead of being
  re-encoded, and `isPristine()` is exported for the same check.
- Size previews on the stroke and font sliders, showing the mark at the
  size it will be drawn.

### Fixed

- Blur redaction silently left the region readable wherever the canvas
  `filter` property is unsupported, as on WebKit before Safari 18. It
  now degrades to pixelation.
- Absolute same-origin URLs were fetched anonymously, which dropped the
  session cookie and turned any `generateRemoteUrl()` source into a 401.
- The saturation slider could not desaturate: its lower half only
  halved the saturation and never reached grey.
- Zooming, panning or resizing the window while cropping discarded the
  rectangle being drawn, and the crop handles snapped into place while
  the image was still turning.
- A stroke released outside the canvas was lost, and a second finger
  landing mid-stroke committed a stray annotation.
- Annotations could not be created at all outside a secure context,
  where `crypto.randomUUID` is undefined.
- The filter cache stayed at scrub resolution after a slider was
  released, leaving the image soft.
- Picking a colour recorded one undo step per shade the pointer
  crossed.
- A failed load left an empty frame with no message and no way to
  retry, and an older load could publish over a newer one.
- Controls were smaller than the minimum pointer target wherever the
  editor is embedded outside a Nextcloud server page, and the rail
  overlapped the controls on a phone.
- A canvas that cannot be read back no longer throws out of the ambient
  tint, and the export explains the cross-origin cause.

### Changed

- `change` now fires when an edit is committed rather than on every
  preview frame of a slider drag.
- The revert confirmation uses `@nextcloud/dialogs`, which is a new peer
  dependency.
- `useHistory` snapshots are held by reference: whatever is pushed must
  not be mutated afterwards. `push()` takes an optional label, and
  `entries`, `index` and `jumpTo()` are new.

### Performance

- Freehand strokes no longer copy their point list and rebuild their
  shape on every pointer move, which made a long stroke quadratic.
- The filter strip redraws its seventeen thumbnails only when the
  image, the crop or the adjustments change.
- Committing and undoing no longer deep-copy the whole state, so undo
  also stops rebuilding the annotations it did not touch.
- Tools and overlays survive a render instead of being torn down and
  rebuilt on every state change.
