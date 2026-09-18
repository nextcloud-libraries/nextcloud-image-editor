<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
# Changelog

## 1.0.0-beta.5 – 2026-09-18

### Added

- `setJpegOrientation`, `readJpegOrientation` and `rotateOrientation`,
  for a host that wants to offer a rotation without opening the editor.
  The Exif tag is rewritten and the scan is copied byte for byte, so the
  picture is never decoded and nothing is lost however many times it
  runs; where the file already names an orientation it is a two-byte
  write and the length does not change. JPEG only: PNG and WebP carry no
  orientation that browsers or Nextcloud's preview generator honour
  (#69)

### Fixed

- A Display P3 photo came back a visible step more saturated. The centre
  pixel of the fixture reads 217, 69, 51 in the source and exported as
  235, 51, 37, because the export carried the source's APP2 profile over
  pixels that were no longer in that space. Chromium converts a
  wide-gamut image into sRGB on decode, so the carried profile made a
  reader convert it twice; Firefox hands the samples over untouched, so
  there the same profile is what makes the file readable. The browser is
  now asked which it is, and the profile is carried only where the
  pixels are still in the space it describes (#68)
- An annotation placed in the margin around the picture was committed
  and then dropped by the export, which renders the visible area alone,
  so it vanished on save with nothing said. Every point is held to the
  picture now, the crop where there is one. A gesture may still start
  outside it, which is how a redaction covers a corner; one whose box
  never meets the picture is dropped rather than committed against the
  edge. A sticker or a caption is placed by a click, so in the margin it
  is refused outright (#67)
- Over a white picture the mode rail's backing measured
  rgb(114, 114, 115), 4.31:1 against its labels, under the 4.5:1 normal
  text needs. At 85% of the chrome background the same picture leaves it
  at 8.99:1 (#67)

## 1.0.0-beta.4 – 2026-09-17

### Added

- Zooming out below the fitted view, down to a quarter of it, and
  panning the picture once it no longer fills the frame. A pinch runs
  straight through to the view rather than being read as a drag (#51)
- A top bar built around the edit rather than around the canvas: an
  undo button of its own, a history menu that leads with revert and
  names every step it can land on, and a close button that asks what to
  do with unsaved changes (#47)
- Clicking an existing annotation picks it up whichever tool is held,
  so moving something no longer means switching to select first (#53)

### Changed

- A JPEG is written at the quality its source was written at, rather
  than whatever the browser picks. The setting is not recorded in a
  file, but the quantization table it produced is, so the table is
  matched against the hundred an encoder can produce. Held between 0.75
  and 0.97, and 0.92 where there is no source to read. On a 12 Mpx
  photo saved at quality 97, an edit used to come back at 38.1 dB PSNR
  and 5.41 MB; it now comes back at 46.0 dB and 7.42 MB (#60)
- The decode and the half-size copies the scene draws from happen in a
  worker, and the canvas cap is probed at the size the image needs
  instead of climbing to 16384². Opening a 12 Mpx photo on a
  phone-class CPU went from 6.1 s to 0.9 s, and the longest frame the
  main thread was held from 5.1 s to 0.4 s. Browsers without
  `OffscreenCanvas`, and pages whose policy refuses the worker, keep
  the old path (#64, #65)
- One set of design tokens for the editor chrome, one text size and one
  typeface across it, and the mode rail carries the same glass as the
  control card so its labels stay readable over a bright photo (#43,
  #45, #56)
- The top bar keeps the close button where the viewer keeps it, fits a
  phone without dropping the zoom controls, and puts undo and redo side
  by side again (#52, #57)

### Fixed

- The loading spinner did not turn. `NcLoadingIcon` animates on a
  `rotate` keyframe that the server stylesheet owns and
  `@nextcloud/vue` does not ship, so embedded anywhere else the icon
  was drawn and then held still (#61)
- A thin stroke can be selected without hitting the one pixel it is
  drawn on: every stroked annotation carries a 24px grab band, measured
  in screen pixels so it holds at any zoom (#50)
- Applying an unchanged crop did nothing and said nothing, and the
  buttons for applying and resetting one now come and go with the
  selection, separator included (#44, #55, #61)
- The crop corner handles were invisible against a light image, the
  adjust tabs wrapped onto a second row, and the slider gave no sign of
  where its neutral value was (#40, #46)

### Still missing

- No translations yet: the Transifex resource behind `l10n/` is not set
  up, so every string falls back to English
- Annotations cannot be created from the keyboard alone, and the
  editor's shortcuts are bound to the window rather than to itself
  (#17)
- A wide-gamut source keeps its ICC profile but not its pixels: the
  export re-tags sRGB numbers as Display P3, which shifts the colour of
  every iPhone photo that is edited (#59)
- Export and preset thumbnails still downscale in one pass, so a saved
  copy bound by `maxSize` is coarser than the same picture on screen
- A quarter turn still re-encodes rather than rewriting the
  orientation, so a rotation costs a generation of quality (#19)
- The eraser, multi-select, per-annotation opacity, freehand redaction
  and exact-pixel crop are not here yet (#2)

## 1.0.0-beta.3 – 2026-09-11

### Added

- Text styling. A caption can carry a contrasting edge, derived from
  the text colour rather than picked (#23), a plate that takes the photo
  out from behind it (#24), one of three system font families (#25),
  an alignment for its lines (#29) and bold, italic, underline and
  strikethrough in any combination (#34). Each applies to the next
  caption and to a selected one alike
- The text controls and the colour picker float next to what they
  change: the overlay while a caption is typed, the selection
  otherwise. The bottom panel keeps the tool picker, the colour default
  and the size slider (#37)
- Lines and arrows snap to 45° steps while Shift or Ctrl is held, and
  the key can be pressed or released mid-drag (#38)
- Oval redactions, inscribed in the same drag as the rectangle (#31)
- Highlights, shadows and a vignette in the adjust panel (#21)
- The saved JPEG carries the source's Exif, XMP, ICC and IPTC blocks,
  with the orientation reset, the size corrected and the embedded
  thumbnail removed. Only when the editor was handed bytes: a URL gives
  it no source to copy from (#22)
- Before opening an image larger than the browser will paint, the
  editor says what it would shrink it to and asks. `ExportResult`
  gains `downscaled` for hosts that want to warn again before
  overwriting (#20)
- The edit history opens from the back arrow, its entries are radios
  that announce the step they land on, and a long list scrolls (#15,
  #16)

### Fixed

- A redaction hid the source pixels, not what was under it: annotations
  drawn below it and the adjustments applied to the image stayed
  readable in the export. It now samples the layer as drawn (#30)
- The embedded camera thumbnail was unlinked but its pixels stayed in
  the file and could be carved back out, the uncropped, unredacted
  frame included. Every strip of it is zeroed before the link is cut
  (#35)
- A state stored by an older release, missing the adjustments added
  since, rendered black: an undefined value ran the filter and left NaN
  in the node. `reset` and `initialState` now fill in what is missing
  (#36)
- A picture shown smaller than half its size is drawn from a halved
  pyramid instead of being sampled in one pass, so fine grain and thin
  lines match what an `<img>` shows. Export and thumbnails still scale
  in one pass (#33)
- The text overlay opened 16px left and 56px above the click, and the
  selection toolbar sat off-centre by the same amount: both were placed
  in stage coordinates but positioned inside the padded viewport (#37)

### Changed

- Saving defaults to the format the image arrived in rather than PNG,
  so a photo is saved as a photo. Hosts asking for a format still get
  it (#22)
- The text controls read like the rest of the panel and share one row
  (#26, #32)

### Still missing

- No translations yet: the Transifex resource behind `l10n/` is not set
  up, so every string falls back to English
- Annotations cannot be created from the keyboard alone, and the
  editor's shortcuts are bound to the window rather than to itself
- Export and preset thumbnails still downscale in one pass, so a saved
  copy bound by `maxSize` is coarser than the same picture on screen
- The eraser, multi-select, per-annotation opacity, freehand redaction
  and exact-pixel crop are not here yet (#2)

## 1.0.0-beta.2 – 2026-09-02

### Added

- Exposure, temperature, tint and sharpen adjustments, bringing the
  panel to seven controls in photographic order. Exposure is
  multiplicative in stops, so its two halves are symmetrical in a way
  brightness cannot be; temperature and tint are the two axes a white
  balance is expressed in; sharpen is an unsharp mask that lifts edges
  and leaves flat areas alone (#7)
- Straight line tool, the arrow without the head: it records the two
  ends of the drag and nothing in between (#8)
- Progress on the save button, covering both the editor's own export
  and the host's upload afterwards, through a new `saving` prop. The
  editor only knows when it handed the blob over, not when it landed
  (#10)

### Fixed

- Every control rendered ten pixels larger than the interface around it
  inside Nextcloud. The editor declared `--default-clickable-area` on
  its own root, which overrode the server's 34px; it now registers a
  fallback instead, so the host's value always wins (#9)

### Changed

- The adjust panel opens on exposure rather than brightness
- The playground and the published demo render against a copy of the
  variables a Nextcloud server serves, rather than hand-written
  stand-ins that were wrong about the clickable area. A weekly workflow
  keeps that copy current (#9)

### Documented

- The package has to be bundled: its entries import their own
  stylesheet, so a plain Node process cannot load them and
  server-side rendering is out (#6)

### Still missing

Carried over from the first beta, so a reader landing here does not
have to scroll for them:

- No translations yet: the Transifex resource behind `l10n/` is not set
  up, so every string falls back to English
- Images beyond roughly 16 megapixels can exceed the browser's canvas
  limits and export blank, on iOS in particular (#1)
- Annotations cannot be created from the keyboard alone, and the
  editor's shortcuts are bound to the window rather than to itself
- Of the tools an image editor is eventually expected to have, the
  eraser, multi-select, per-annotation opacity, text styling, freehand
  redaction and exact-pixel crop are not here yet (#2)

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
