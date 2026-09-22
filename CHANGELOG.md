# Changelog

Every release of Zia, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.23.0] — 2026-09-22

Everything since 2.13.0, including four community pull requests. The 2.22.x
versions were local test builds and were never published; what they changed
is folded in here as it finally stands.

### Added

- **Folder colours.** Right-click a folder and choose **Folder Color**. The
  eight colours are sampled from Dia's palette. A coloured folder sits at a
  light wash of its colour and comes up to the full colour on hover, and its
  name takes a tint of the same colour. **White** returns a folder to the
  default. Colours are kept across restarts.
- **Delete a folder from its header.** Hovering a folder's header row shows an
  ×, drawn dimmed like the folder's chevron, that deletes the folder exactly as
  **Delete Folder** in the right-click menu does, including closing its tabs.
- **Advanced Tab Groups support.** Plain tab groups, like the ones
  [Advanced Tab Groups](https://github.com/Vertex-Mods/Advanced-Tab-Groups)
  makes, get the same folder treatment as Zen folders, including suggested
  icons. ([#5](https://github.com/z1n-k/zia/pull/5), by @trashshii007)
- **Light search panel.** The expanded address bar follows Zen's *Website
  appearance* setting and turns light when websites are set to light.
  ([#10](https://github.com/z1n-k/zia/pull/10), by @bsramin)

### Changed

- **Space name and icon are drawn as one element**, built from Zen's
  workspace data, so the hover pill sits evenly around the name whether or not
  the space has an icon.
- **Tab buttons have softer corners.** The close (×) and unload (–) buttons
  use a 6px squircle, the tab's own shape scaled down, and both now share it.
- **The download progress ring is thinner**, about 2px.
- **Essentials are 1px taller.**
- **The blended address bar works on transparent pages.** Colour sampling
  accounts for transparency and the frame behind the page.
  ([#8](https://github.com/z1n-k/zia/pull/8), by @trashshii007)

### Fixed

- Tabs no longer show through the music player. It keeps its translucent look
  at rest and fades to a solid version of the same colour while hovered, when
  it grows over the bottom of the sidebar. The colour is worked out from the
  sidebar's own, so it follows each space's colour.
- Clicking the address bar selects the whole address, not just its first few
  characters.
- With the sidebar on the right, the page has a gap along the window's left
  edge, and the traffic lights sit in the sidebar beside the space name,
  whether the sidebar is showing or slides out.
- The unload (–) button on tabs is the same 22px box as the close (×) button.
- A space's icon no longer disappears when the space name is hovered, and no
  longer needs a click to appear after startup.
- A stray first letter of the space name no longer shows on hover when a
  space has no icon, and the hover pill no longer has extra room on the right.
- The floating address bar keeps its own position and rounded corners.
- Toolbar and address-panel text stays readable under light browser themes.
  ([#10](https://github.com/z1n-k/zia/pull/10), by @bsramin)
- Titlebar controls in compact mode on Windows, and the sidebar's open state in
  compact mode is tracked reliably.
  ([#7](https://github.com/z1n-k/zia/pull/7), by @trashshii007)

## [2.13.0] — 2026-09-19

### Added

- Folder icons and names are suggested by a local model when a folder is
  created with its default name and no icon.

## [2.9.2] — 2026-09-19

### Changed

- Active tab glow on Windows, folder icons, essentials columns, drag highlight,
  new tab panel, space name, unload button and brand label.

## [2.8.3] — 2026-09-18

### Changed

- Essentials fit their columns to the available space instead of using fixed
  breakpoints.

## [2.8.0] — 2026-09-18

### Changed

- Essentials use three columns on a narrow sidebar.

## [2.7.6] — 2026-09-18

### Fixed

- Folder icons centre in their row.

## [2.7.5] — 2026-09-18

### Added

- Author and homepage in `theme.json` for the Sine store.

## [2.7.3] — 2026-09-18

### Fixed

- Windows: the box that clips the active tab's glow is padded, so the glow
  isn't cut off.

## [2.7.2] — 2026-09-18

### Fixed

- Windows: room for the active tab's glow at the bottom of the tab list.

## [2.7.1] — 2026-09-18

### Changed

- Firefox is left to hide the downloads button when there are no downloads.

## [2.7.0] — 2026-09-18

### Added

- Feature toggles for the music player, find bar, icon picker and undo close.

## [2.6.0] — 2026-09-18

First tracked release.

[2.23.0]: https://github.com/z1n-k/zia/compare/df4a06f...v2.23.0
[2.13.0]: https://github.com/z1n-k/zia/commit/df4a06f
[2.9.2]: https://github.com/z1n-k/zia/commit/92b50b8
[2.8.3]: https://github.com/z1n-k/zia/commit/1eb4259
[2.8.0]: https://github.com/z1n-k/zia/commit/20829bc
[2.7.6]: https://github.com/z1n-k/zia/commit/1c2d623
[2.7.5]: https://github.com/z1n-k/zia/commit/dd3465c
[2.7.3]: https://github.com/z1n-k/zia/commit/3f3a3bc
[2.7.2]: https://github.com/z1n-k/zia/commit/40284ea
[2.7.1]: https://github.com/z1n-k/zia/commit/b5d8b8c
[2.7.0]: https://github.com/z1n-k/zia/commit/86effde
[2.6.0]: https://github.com/z1n-k/zia/commit/cfde8c0
