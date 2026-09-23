# Changelog

Every release of Zia, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.30.0] — 2026-09-24

Everything since 2.29.0. The 2.29.1 through 2.29.44 versions were local test
builds and were never published; what they changed is folded in here as it
finally stands.

### Added

- **Copy link.** A paperclip in the address bar, just left of site settings,
  in each split pane's toolbar, and on hover cards. It copies the page's
  address, shows a tick for a moment, and only appears on web pages.
- **Essentials back to tabs.** Dragging an essential off the essentials turns
  it back into a tab, and back into a tile over the essentials.
- Trackpad taps that follow what you see: one per row a dragged tab passes,
  and one each time the essentials make room somewhere new. Zen's own taps,
  which came in bursts during a drag, are switched off for its length.

### Changed

- Hover cards grow in only when none is showing, swap straight over when you
  move to another tab, folder or essential, and shrink out when they go. They
  stay up while the pointer is on them and go when it leaves. Copy link and
  Bookmark keep the card up.
- Hover cards have an even hairline edge all round, as in Dia, with no
  shadow, and the grey address on them is a size bigger.
- The folder card keeps working like the sidebar: closing or unloading tabs
  from it keeps it open, its "−" turns into ✕ once a tab is unloaded, its
  buttons sit where a tab's do, and its "+ New Tab" matches the sidebar's.
- The selected tab has no glow as the very first or last row, including a
  new tab at the bottom.
- No icon in the address bar shrinks when clicked.

### Fixed

- A dragged essential can be dropped at the end of the essentials, and the
  tile a dragged tab turns into is exactly the size of the others.
- An essential with its hover card up can be clicked all over.
- Resizing the sidebar no longer shows a dark bar up its edge.
- No lone "/" while a page is loading.

## [2.29.0] — 2026-09-23

Everything since 2.28.0. The 2.28.1 through 2.28.37 versions were local test
builds and were never published; what they changed is folded in here as it
finally stands.

### Added

- **The first essential by dragging.** With no essentials in a space, dragging
  a tab above the list opens a row and makes it the first one. Zen's dashed
  "Add to Essentials" box no longer appears.

### Changed

- **Dragging onto the essentials.** The tile a tab turns into is the real
  essential, favicon glow and rim included, at exactly the size of the tiles
  beside it, drawn over everything so it's never cut off at the sidebar's
  edge. Over a full row, the tiles make room properly: the last one moves
  down to a new row, lined up with the rest.
- Coloured folders use Dia's strengths: a deeper tint at rest that brightens
  on hover, and a name that pales as the folder is hovered.
- On a space with its own colour, the selected result in the address bar is
  lightly tinted by it.
- The reload icon matches Dia's more closely, and the address bar's hover box
  on dark pages is a touch lighter.
- The selected tab has no glow when it's the very first or last row.
- A scrolling list of results leaves the panel 4px shorter.

### Fixed

- Dragging a tab no longer shows another space's essentials, and a tab
  dragged into a folder no longer gets squeezed to a sliver.
- The separator moves out of the way in every space, by exactly one row, with
  + New Tab staying in view. With no normal tabs left, it shows again while
  you drag, so a pinned tab can go back down.
- A long folder card scrolls without cutting off its edge, and its
  "+ New Tab" keeps a collapsed folder collapsed.
- The icon beside a typed address finds sites whose favicon is kept under
  their www. address (twitch.tv and others) instead of showing the globe.
- The + New Tab button has exactly a tab's corners.
- In the address bar's results, the part of an address that matches what
  you typed stays grey.

## [2.28.0] — 2026-09-23

Everything since 2.27.0. The 2.27.1 through 2.27.51 versions were local test
builds and were never published; what they changed is folded in here as it
finally stands.

### Added

- **Tab dragging, like Dia's.** The tab itself follows the pointer and the
  rows it passes slide aside; there's no ghost tab and no drop line, and a
  dropped tab doesn't slide into place. Dragged over a folder, the folder
  opens up by a row to take it, and the tab narrows to a folder tab's width;
  dropped into a collapsed folder, the folder stays collapsed and shows the
  tab under its header. Just below a folder, the upper half of the gap drops
  into it and the lower half next to it, so the space between two folders
  is reachable. Tabs cross the separator in either direction, a split drags
  as one row, and over the essentials a tab turns into the tile it will
  become.
- **Folder cards.** Hovering a collapsed folder lists the tabs inside it,
  each with its icon and name. The speaker mutes and unmutes, hovering a row
  shows ✕ to close the tab or "−" to unload a pinned one, the tab you're on
  is dark, and "+ New Tab" opens a tab in that folder. It replaces Zen's
  folder search popup while hover cards are on; the option in Sine is now
  "Tab and folder hover cards".

### Changed

- Hover cards for internal pages, such as Settings, show the page's name and
  the action buttons; only a new tab keeps the title-only card. The tab
  you're on offers Add to Split too, splitting with the tab you used before.
- An essential's hover card sits right at the tile's corner.
- The back and forward arrows are the height of the sidebar button beside
  them, and the reload icon has Dia's shape.
- Clicking away from the address bar puts the page's address back instead of
  leaving half-typed text in it.
- Tabs have the New Tab button's corner shape, and the active tab inside a
  folder has the same dark background and glow as any active tab.
- A Dia or Zen icon set on a space shows beside its name, in the name's
  colour.

### Fixed

- Clicking the address bar no longer puts `https://` or `www.` back, selects
  the whole address even while the page loads, and typing no longer loses a
  letter when Firefox fills in an address starting with "www.".
- A loading tab's address no longer shows bright white before dimming.
- Hover cards no longer have a thin black line round them, and Add to Split
  shows its full icon.
- A coloured folder's name keeps its tint when the folder is open.
- Hovering a collapsed folder no longer lights up a hidden tab under its
  header, and the active tab's glow isn't cut off inside one.

## [2.27.0] — 2026-09-23

Everything since 2.23.0. The 2.23.1 through 2.26.x versions were local test
builds and were never published; what they changed is folded in here as it
finally stands.

### Added

- **Tab hover cards, like Dia's.** Hovering a tab shows a card with its title
  and address after 0.6s, growing in from 70%. It carries add to Essentials,
  bookmark, and add to split, and a pinned tab or an essential shows unpin
  where the pin would be. Essentials is hidden when the tab is already one,
  split is hidden for the tab you're on, and a new tab or internal page shows
  just its title. Zia draws the card itself. There's an option to turn the
  cards off in Sine's settings for Zia, on by default, and switching it takes
  effect straight away.
- **Extensions in split view, like Dia.** In a split, your pinned extension
  buttons sit in the focused pane's toolbar, just left of its own buttons, and
  move with the focus. They're Firefox's own buttons, moved rather than
  copied, so badges, popups and clicks work as usual, and they go back to the
  main toolbar when the split ends.

### Changed

- **Address bar ink follows the page, like Dia.** On a dark page such as
  YouTube or Duelbits, the domain, path and toolbar icons are a dull grey
  rather than white. A literally black page stays white. The hover highlight
  darkens the bar, or lightens it when the bar is black.
- **The address never shows `https://`, `http://`, or a leading `www.`**,
  including once the bar is open. `www.twitch.tv/xqc` shows as `twitch.tv/xqc`.
- **Split view spacing like Dia's:** 10px between panes, a frame round them,
  on a slightly darker backdrop.
- **The hover card's border matches the essentials':** 1px and a little
  dimmer, brightest along the sides, soft at the corners. The card grows in a
  little more slowly.
- **Tab names, folder names and address bar text are 0.1px smaller.** They
  share one size, so they all moved together.

### Fixed

- An essential's hover card sits just off the tile's bottom-right corner, the
  way Dia's does, instead of covering the tile. A clear patch at that corner
  still lets the pointer move onto the card. With the sidebar on the right it
  hangs off the bottom-left.
- The hover card's action buttons show their icons.
- The dragged tab's image is just the tab, without the active tab's glow
  around it or any of Zia's motion on it.
- Swiping between spaces no longer lets the sliding tabs run past the sidebar
  and over the page.
- The space name highlights over its whole width, and only when the pointer is
  actually over it. The first letters were missed, and empty space beside the
  name was lighting it up.
- The unload (–) button on a folder's header is the same dimmed colour as the
  × next to it.
- Pinned extension buttons no longer fade their background in and out. The
  hover is instant.

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

[2.27.12]: https://github.com/z1n-k/zia/compare/v2.27.11...v2.27.12
[2.27.11]: https://github.com/z1n-k/zia/compare/v2.27.10...v2.27.11
[2.27.10]: https://github.com/z1n-k/zia/compare/v2.27.9...v2.27.10
[2.27.9]: https://github.com/z1n-k/zia/compare/v2.27.8...v2.27.9
[2.27.8]: https://github.com/z1n-k/zia/compare/v2.27.7...v2.27.8
[2.27.7]: https://github.com/z1n-k/zia/compare/v2.27.6...v2.27.7
[2.27.6]: https://github.com/z1n-k/zia/compare/v2.27.5...v2.27.6
[2.27.5]: https://github.com/z1n-k/zia/compare/v2.27.4...v2.27.5
[2.27.4]: https://github.com/z1n-k/zia/compare/v2.27.3...v2.27.4
[2.27.3]: https://github.com/z1n-k/zia/compare/v2.27.2...v2.27.3
[2.27.2]: https://github.com/z1n-k/zia/compare/v2.27.1...v2.27.2
[2.27.1]: https://github.com/z1n-k/zia/compare/v2.27.0...v2.27.1
[2.27.0]: https://github.com/z1n-k/zia/compare/v2.23.0...v2.27.0
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
