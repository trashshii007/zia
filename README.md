# Zia

**Zen Browser, with a Dia-inspired face.**

A [Sine](https://github.com/CosmoCreeper/Sine) mod that reworks Zen's frame, taking its cues from [Dia](https://www.diabrowser.com): the page in a rounded card, a toolbar that takes the colour of the site under it, and a sidebar and address bar in the same spirit. Some of it goes its own way — the music player is Zia's own design, and Dia has nothing like it.

![Status](https://img.shields.io/badge/status-alpha-orange)
![Platform](https://img.shields.io/badge/tested%20on-macOS%20%C2%B7%20dark%20mode-informational)
![Licence](https://img.shields.io/badge/licence-MIT-blue)

> **Alpha.** Built and tested on macOS, dark mode, **Sidebar and Top Toolbar** layout. Light mode, the other layouts, Windows and Linux are untested and will likely need work. Feedback on those is exactly what's wanted.

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

Other mods may conflict, and Zia won't be adjusted to accommodate them. If something looks wrong, turn your other mods off and add them back one at a time.

## Workspace icons

The workspace and folder icons carry a lot of the Dia look, and they're worth setting up.

▶ **[Zia: setting up workspace icons](https://vimeo.com/1228144298)**

---

## What it does

### The page and the toolbar

The page and toolbar sit together in one rounded card. The toolbar takes the colour of the site under it and follows that colour as you scroll, switching to dark text on light sites. Colours are remembered per host, so a page opens in the right colour rather than fading into it. A glow travels along the address bar while a page loads, and the address itself reads as `domain / title`, showing the full URL when you hover it.

### The address bar

Opened, the panel follows Dia's shape: short rows with air around them, one size and weight of text throughout, and none of Firefox's chips, row menus or one-off engine bars. What you type stays lined up with the results underneath it.

### The sidebar

Essentials sit as tiles, four to a row and six when the sidebar is wide. Folders get hover boxes, a bounce when they open, and icon or emoji covers. Plain tab groups, like the ones [Advanced Tab Groups](https://github.com/Vertex-Mods/Advanced-Tab-Groups) makes, get the same folder treatment. Downloads live next to the space name with a progress ring around them. Closing a tab by accident is undone with Cmd/Ctrl+Z for ten seconds afterwards.

![Essentials and folders in the sidebar](https://github.com/user-attachments/assets/0c439e9d-651e-414c-8b85-d5bc8308aef4)

Spaces with a colour of their own carry it through the sidebar:

![A coloured space](https://github.com/user-attachments/assets/2b8748a4-d7fc-4ef0-a5b3-41ab3243e83b)

Covers come from an icon picker Zia adds as a third tab beside Zen's own: 1,512 Phosphor icons with their own search, and Zen's emojis still there if you'd rather use one of those.

![The icon picker](https://github.com/user-attachments/assets/07c2baf3-9af4-4d7f-a6c9-b9701070312a)

### Media and split view

Playing music gives you a card with the track's artwork and a glow in its colours. Sound bars in those same colours appear on essentials and tabs, turning to dots when muted, and clicking them toggles the sound. It handles livestreams as well as ordinary videos.

![The music player card](https://github.com/user-attachments/assets/5b4e2542-61a9-4fd6-b2ee-7fb58970ef5b)

Split view gives each pane its own toolbar. Dragging a tab over the page brings up drop cards for either side, growing and turning blue as you get near the edge:

![Dragging a tab into a split](https://github.com/user-attachments/assets/50fed722-962c-4af6-9979-18800ae01a50)

Drop it and both sites sit side by side, each with its own address and controls:

![Two sites in split view](https://github.com/user-attachments/assets/5318d0ce-d6b3-4adb-aef9-56ffbed72ae9)

---

## Options

**Settings → Sine Mods → Zia**

Parts of the theme can be switched off individually. Everything is on by default.

| Feature | Default |
| --- | --- |
| Music player card | on |
| Find in page bar | on |
| Icon picker | on |
| Undo a closed tab with Cmd/Ctrl+Z | on |
| New tabs open your default search engine's page | on |
| Use Zen's accent colour for the loading bar | off |
| Small bounce when folders open or close | on |

More features become switchable with each release. The styling toggles apply straight away; the ones that change behaviour need a restart.

<details>
<summary><b>Zen settings Zia changes</b></summary>

Changed at the default level only. If you've set either yourself in `about:config`, your choice is kept.

- `zen.widget.mac.mono-window-controls` → off, for native macOS window buttons
- `zen.urlbar.replace-newtab` → off, so **+ New Tab** and Cmd+T open a real new tab

</details>

## Folder names and icons from a local model

Make a folder and Zia can name it and pick its icon for you, using a model that
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
