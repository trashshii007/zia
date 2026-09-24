# Zia

**Zen Browser, rebuilt with a Dia-inspired finish.**

Zia is a [Sine](https://github.com/CosmoCreeper/Sine) mod that reworks Zen from the frame in. The page sits in a rounded card, the toolbar takes on the colour of whatever site you're on, and the sidebar, address bar, media and picture-in-picture are all redesigned to match. It takes its cues from [Dia](https://www.diabrowser.com) and then keeps going: the music player, Multiview and picture-in-picture tucking are Zia's own, and Dia has nothing like them.

![Status](https://img.shields.io/badge/status-alpha-orange)
![Platform](https://img.shields.io/badge/tested%20on-macOS%20%C2%B7%20dark%20mode-informational)
![Licence](https://img.shields.io/badge/licence-MIT-blue)

What's new in each release: [CHANGELOG.md](CHANGELOG.md).

> **Alpha.** Built and tuned on macOS, dark mode, with the **Sidebar and Top Toolbar** layout. Light mode, the other layouts, Windows and Linux haven't been tested yet and will likely need work. Feedback on those is very welcome.

---

![Zia](https://github.com/user-attachments/assets/998f92b8-74ea-4bac-8131-6ab4a9993ab7)

---

## Install

Zia is a JavaScript mod, so Sine needs permission to load scripts from outside its marketplace.

1. Install [Sine](https://github.com/CosmoCreeper/Sine).
2. In Zen: **Settings → Sine Mods**, open Sine's settings, turn on **installing JS from unofficial sources**.
3. Paste this into the box under the marketplace:

   ```
   z1n-k/zia
   ```

4. Restart Zen when Sine asks. If the mod doesn't load, open `about:support` and click **Clear startup cache**.

**Set Look and Feel → Sidebar and Top Toolbar**, and use dark mode.

Other mods may conflict, and Zia won't be adjusted around them. If something looks off, turn your other mods off and add them back one at a time.

## Workspace icons

Workspace and folder icons do a lot of the work in the Dia look, so they're worth five minutes.

▶ **[Zia: setting up workspace icons](https://vimeo.com/1228144298)**

---

## What it does

### The page and the toolbar

The page and toolbar sit together in one rounded card. The toolbar picks up the colour of the site underneath and follows it as you scroll, switching to dark text on light sites. Colours are remembered per site, so pages open already in their colour instead of fading into it. While a page loads, a glow runs along the address bar. The address itself reads as `domain / title`, and hovering it shows the full URL.

![The toolbar on a light page](<https://raw.githubusercontent.com/z1n-k/zia/readme-images/toolbar-light.webp>)

![The toolbar on a dark page](<https://raw.githubusercontent.com/z1n-k/zia/readme-images/toolbar-dark.webp>)

### The address bar

The address pop-up follows Dia's shape: short rows with room around them, one size and weight of text throughout, and none of Firefox's chips, row menus or extra engine bars. What you type lines up exactly with the results underneath. As you type an address, the site's own icon takes the place of the magnifying glass. A paperclip beside site settings copies the page's link. The whole bar can also move to the **bottom**, under the page, with the pop-up opening upwards, in a single page or a split.

### The sidebar

Essentials sit as tiles, four to a row, or six when the sidebar is wide. Folders get hover boxes, a small bounce when they open, icon or emoji covers, an × to delete them, and a colour of their own from the right-click menu that tints the whole folder:

![A tinted folder](<https://raw.githubusercontent.com/z1n-k/zia/readme-images/folder-tint.png>)

Plain tab groups, like the ones [Advanced Tab Groups](https://github.com/Vertex-Mods/Advanced-Tab-Groups) makes, get the same folder treatment. Downloads sit next to the space name with a progress ring around them.

Tabs drag the way they do in Dia. The tab itself follows the pointer while the rows it passes slide aside, a folder opens up by a row to make room, and over the essentials a tab turns into the tile it's about to become. Drag an essential back off and it's a tab again. Hovering a tab shows a card with its title, address and a few actions; hovering a collapsed folder lists what's inside.

Cmd/Ctrl+Z reopens what you just closed for ten seconds afterwards. That includes whole folders, splits and groups of tabs: a split comes back as a split, and a deleted folder comes back with its name.

![Essentials and folders in the sidebar](https://github.com/user-attachments/assets/0c439e9d-651e-414c-8b85-d5bc8308aef4)

Spaces with a colour of their own carry it through the sidebar:

![A coloured space](https://github.com/user-attachments/assets/2b8748a4-d7fc-4ef0-a5b3-41ab3243e83b)

Covers come from an icon picker Zia adds as a third tab beside Zen's own: 1,512 Phosphor icons with their own search, and Zen's emojis are still there if you'd rather use one.

![The icon picker](https://github.com/user-attachments/assets/07c2baf3-9af4-4d7f-a6c9-b9701070312a)

### Music and split view

Playing music brings up a card with the track's artwork and a soft glow in its colours. It handles live streams as well as ordinary videos. Playing tabs get sound bars instead of Zen's speaker, and so do essentials. The bars turn to dots when muted and toggle the sound when clicked.

![The music player card](https://github.com/user-attachments/assets/5b4e2542-61a9-4fd6-b2ee-7fb58970ef5b)

In split view, each pane gets its own toolbar. Drag a tab over the page and drop cards rise on either side, growing and turning blue as you near the edge:

![Dragging a tab into a split](https://github.com/user-attachments/assets/50fed722-962c-4af6-9979-18800ae01a50)

Let go and both sites sit side by side, each with its own address and controls:

![Two sites in split view](https://github.com/user-attachments/assets/5318d0ce-d6b3-4adb-aef9-56ffbed72ae9)

### Picture-in-picture

Picture-in-picture looks like Dia's. At rest it's just the video, with nothing laid over it. Hover it and the video dims to show **Back to Tab** and **Close** at the top with the site between them, big 15-second skip and play/pause buttons in the middle, and a thin progress line along the bottom.

![Picture-in-picture over the browser](<https://raw.githubusercontent.com/z1n-k/zia/readme-images/pip.webp>)

When you need the screen back, tuck it away. Press the tuck button beside Close, or drag the window against the left or right edge of the screen (a blue edge says *Let go to tuck away*), and it slides off, leaving a slim strip. Point at the strip and the video glides back out; move away and it tucks itself away again.

<img src="https://raw.githubusercontent.com/z1n-k/zia/readme-images/pip-tucked.png" alt="Picture-in-picture tucked into the side of the screen" width="180">

### Multiview

Multiview turns a tab into a wall of videos. Right-click any video, a video's page or its tab and choose **Add to Multiview**:

<img src="https://raw.githubusercontent.com/z1n-k/zia/readme-images/multiview-menu.webp" alt="Add to Multiview in a video's right-click menu" width="360">

The first video opens the Multiview tab and the rest join it. The grid re-tiles itself to fill the tab, always at the biggest size that fits, as videos come and go. It's made for following several live streams at once.

![Multiview with three videos](<https://raw.githubusercontent.com/z1n-k/zia/readme-images/multiview-grid.webp>)

Hover a tile to drag it to a new spot, give it the sound (one tile plays at a time, marked with a white ring), open it on its site or remove it. Videos pick up from where you were, and live streams join live.

![A Multiview tile on hover](<https://raw.githubusercontent.com/z1n-k/zia/readme-images/multiview-tile.webp>)

Multiview works with **YouTube, Twitch** (live, videos and clips), **Kick, Vimeo, Dailymotion** and plain video files. Sites with copy protection, such as Netflix or sports services, can't be added. The Multiview page is hosted on this repo's [GitHub Pages](https://z1n-k.github.io/zia/multiview/), because YouTube and Twitch only play embedded videos on a real web address. Your list of videos lives in the page's own address, so it survives a restart, and it's never sent anywhere.

---

## Options

**Settings → Sine Mods → Zia**

Almost every part of Zia can be switched on or off on its own.

| Feature | Default |
| --- | --- |
| Music player card | on |
| Sound bars on playing tabs (off: Zen's speaker) | on |
| Tint the selected tab's glow and the sound bars with the site's colours | off |
| The last essential stretches across the rest of its row | off |
| Toolbar takes the colour of the site (off: the theme's colour) | on |
| Zia's rounded page corners (off: Zen's own) | on |
| Split view drop cards when dragging a tab onto the page (off: Zen's own) | on |
| Address bar position: top or bottom (not with Zen's single toolbar) | top |
| Dia-style address bar pop-up (off: Zen's own) | on |
| Cmd/Ctrl+T and **+ New Tab** open a real tab (off: Zen's floating address bar) | on |
| Find in page bar | on |
| Icon picker | on |
| Undo a closed tab with Cmd/Ctrl+Z | on |
| New tabs open your default search engine's page | on |
| Use Zen's accent colour for the loading bar | off |
| Small bounce when folders open or close | on |
| Dia-style picture-in-picture controls (off: Firefox's own) | on |
| Tuck picture-in-picture into the side of the screen | on |
| **Add to Multiview**: grid videos and live streams in one tab | on |

More features become switchable with each release. The styling toggles apply straight away; the ones that change behaviour need a restart.

<details>
<summary><b>Zen settings Zia changes</b></summary>

Changed at the default level only. If you've set either yourself in `about:config`, your choice is kept.

- `zen.widget.mac.mono-window-controls` → off, for native macOS window buttons
- `zen.urlbar.replace-newtab` → off, so **+ New Tab** and Cmd+T open a real new tab. Turn off **Cmd/Ctrl+T and + New Tab open a real tab** to get Zen's floating address bar back.

</details>

## Folder names and icons from a local model

Make a folder and Zia can name it and choose its icon for you, with a model that
runs on your machine. Three tabs from Levi's, Gucci and Louis Vuitton become a
folder called **Clothing** with a clothing icon; PayPal, Stripe and Cash App
become **Financial**. Nothing is sent anywhere.

It's **off by default**, because the first use downloads a model (about 25MB).
To turn it on:

1. Open `about:config` and set **`browser.ml.enable`** to `true`. This is
   Firefox's local AI runtime, which Zen ships but leaves switched off.
2. Restart Zen.
3. In **Settings → Sine Mods → Zia**, turn on **Suggest a folder's icon with a
   local model**.

The first folder you make takes a few seconds while the model downloads and the
1,512 icon names are read once. After that it's immediate, and the icon names
are cached in your profile.

It only ever fills in a folder that has no icon and still has its default name,
so anything you've named or chosen yourself is left alone. Groups made with
Advanced Tab Groups get the same treatment, with the icon saved through that mod.

<details>
<summary><b>Known gaps</b></summary>

- Compact mode has no transparency or backdrop blur yet
- Light mode is untested and will very likely need work
- Other sidebar layouts, Windows and Linux are untested

</details>

---

## About the name and the look

Zia is an independent, unofficial project. It isn't affiliated with, endorsed by, or connected to Dia or The Browser Company, and it contains none of their code or assets. It's a Zen Browser theme built by eye, taking design inspiration from a browser I liked the look of.

## Credits

Icons are [Phosphor](https://phosphoricons.com), MIT licensed and bundled unmodified; their licence is in `icons/phosphor/LICENSE`.

The bleeding corners technique was inspired by [Bleeding Corners Fix](https://github.com/rsiebertdev/zen-themes/tree/main/bleeding-corners-fix) by rsiebertdev. Zia uses its own implementation, matched to its card shape.

## Licence

[MIT](LICENSE).
