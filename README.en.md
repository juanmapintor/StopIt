# StopIt for YouTube

[Leer en español](README.md)

StopIt opens your subscriptions on YouTube Home and hides Shorts. On phones it runs as a userscript in Safari or Firefox. It also shows your subscriptions beside the player on desktop and below the video on your phone.

I developed StopIt with the help of AI, primarily for my own use. I’m sharing it so you can use it, adapt it to your habits, or distribute your own version.

Already using StopIt? [How to update StopIt](#update-stopit)

## Install on your phone

### iPhone or iPad with Safari

1. Install [Userscripts](https://apps.apple.com/app/userscripts/id1463298887), open the app once, and enable the extension in Safari.
2. In Safari, open the [StopIt userscript](https://raw.githubusercontent.com/juanmapintor/StopIt/main/mobile/stopit.user.js). Open **Userscripts** in the page’s extensions menu and confirm installation. If you already downloaded the file, you can also save it in the directory shown in the Userscripts app.
3. Open YouTube in Safari and allow Userscripts to run on the site. Reload the tab.

**If StopIt only starts after a reload when you type `youtube.com` in a new tab**, open **Settings → Apps → Safari** on your iPhone (or **Settings → Safari** on older versions). Under **Search**, turn off **Preload Top Hit** and try again in a new tab. Safari can display a preloaded page without running Userscripts. [Userscripts issue](https://github.com/quoid/userscripts/issues/977)

### Android with Firefox and Violentmonkey

1. In Firefox for Android, install [Violentmonkey](https://addons.mozilla.org/android/addon/violentmonkey/).
2. Open the [StopIt userscript](https://raw.githubusercontent.com/juanmapintor/StopIt/main/mobile/stopit.user.js) in that Firefox browser and confirm installation in Violentmonkey. If you already have the local file, you can also create a script in the manager’s editor, replace its contents with `stopit.user.js`, and save it.
3. Open YouTube in Firefox and reload any YouTube tabs that were already open.

### What to expect on mobile

Open [YouTube Home](https://m.youtube.com/) in the configured browser to see the feed for your signed-in account. On a video page, browse your subscriptions below the player or select **Back to my subscriptions**. The panel marks the current video as **Now playing**. If the feed fails to load, you can retry or open Subscriptions.

Tap the red **StopIt** icon in the YouTube header to open **StopIt settings**. When the header is unavailable, look in the lower-right corner. Turn on **Strict mode** to group the feed and player panel into **New**, **Older**, and **Watched**. **Show notifications** controls the bell and **Show Create button** controls the creation shortcut in the top bar. All three settings start off. The manager stores preferences on your device and keeps history separately for each YouTube account.

On Subscriptions, StopIt hides the row of channel avatars. It also hides Shorts shelves as you scroll and YouTube’s prompts to install or open the app. In Safari it also removes the metadata YouTube uses to request the App Store banner. If Safari already displayed its own banner before Userscripts ran, you can dismiss it in the browser.

Shorts links open Subscriptions. For ambiguous links, StopIt checks the video metadata and offers a retry if verification fails. If a link opens the YouTube app, open it in the configured browser to use StopIt.

### Acknowledgments

- Thank you to Justin Wasack (quoid), ACTCD, and the Userscripts contributors. Your work lets people run StopIt in Safari with the YouTube account they already use on their iPhone. [Userscripts repository](https://github.com/quoid/userscripts)
- Thank you to Gerald (gera2ld), tophf, and the Violentmonkey contributors for making it possible to run the same script in Firefox for Android. [Violentmonkey repository](https://github.com/violentmonkey/violentmonkey)

## Install in desktop Chrome

You need Chrome 120 or later.

1. Download the Chrome ZIP for the version you want to install. Look for a filename such as `stopit-v3.2.0-chrome.zip`. [StopIt releases](https://github.com/juanmapintor/StopIt/releases)
2. Extract the ZIP to a folder you can keep. It contains `manifest.json` at the top level.
3. Open `chrome://extensions` and turn on **Developer mode**.
4. Select **Load unpacked** and choose the folder containing `manifest.json`.
5. Reload any open YouTube tabs. StopIt uses the YouTube account signed in to that Chrome profile.

If you already have a local copy of the repository, start at step 3 and select the `extension` folder. To check the installation, open YouTube Home. The address changes to `/feed/subscriptions`.

StopIt follows Chrome’s display language. Its settings, section names, and messages appear in Spanish for all Spanish regional variants. It uses English for every other language. YouTube displays its own content and controls in the language you chose on the site.

## Update StopIt

### iPhone or iPad with Safari and Userscripts

1. In Safari, open **Userscripts** from the extensions menu and tap the cloud icon to view updates. If the list is empty, tap **Check Updates**.
2. If **StopIt for YouTube** appears, tap **Update**. To update manually, open the script in Safari, open **Userscripts** in that tab, and confirm installation over the existing copy. [Latest userscript](https://raw.githubusercontent.com/juanmapintor/StopIt/main/mobile/stopit.user.js)
3. Reload your YouTube tabs. In version 2, tap the **StopIt** icon on YouTube to open its settings.

### Android with Firefox and Violentmonkey

1. In Firefox, open **Violentmonkey** from the extensions menu and go to its dashboard. Find **StopIt for YouTube** and tap the circular arrow on its row to check for updates.
2. Confirm the update if prompted. When upgrading from version 1 to version 2, StopIt requests access to the manager’s storage for settings and strict-mode history. You can also open the script in Firefox and confirm reinstallation over the existing copy. [Latest userscript](https://raw.githubusercontent.com/juanmapintor/StopIt/main/mobile/stopit.user.js)
3. Reload your YouTube tabs and tap the **StopIt** icon to open its settings.

### Desktop Chrome

1. Download the ZIP ending in `-chrome.zip` and extract its contents into the **same folder** you loaded in Chrome. Replace the existing files to keep your settings and history. If you loaded the `extension` folder from Git, update that checkout. [Latest Chrome release](https://github.com/juanmapintor/StopIt/releases/latest)
2. Open `chrome://extensions` and click the reload button on the StopIt card. Check that the version on the card matches the ZIP.
3. Reload your YouTube tabs.

## What you’ll see in desktop Chrome

- **Home and Subscriptions.** Videos appear newest first. StopIt filters out recommendation shelves, Shorts, scheduled premieres, and cards for ads, playlists, and mixes in the subscription feed. Live streams appear in order of their start time when YouTube provides it. Otherwise, they keep their place in the feed. Replays appear by publication date. Scroll down to load more videos.
- **Shorts.** StopIt hides the sidebar shortcut, Shorts rows in the feed, and entire Shorts shelves in search results, including shelves added as you scroll. It also hides the Shorts filter or tab in History, playlists, Watch Later, Liked videos, search, and channel pages.
- **Beside the player.** The sidebar shows the same subscription feed in the same order, even when you open a video from an external link. Scroll inside the panel to load more. The current video carries a **Now playing** label if it appears in the feed. Selecting another video opens it in the main tab. You can also use its link menu to open it in a new tab. When you scroll through comments, the sidebar stays below YouTube’s top bar and fills the available height, including in Theater mode. Live chat and the playlist queue remain accessible.
- **Shared links.** A direct Shorts link opens Subscriptions. For an ambiguous video link, StopIt checks the video’s metadata before opening it. This includes links to the embedded player that you open as a page in a tab. Regular videos retain the link’s playlist parameters and timestamp.
- **Loading and errors.** The panel shows a loading indicator and tells you when the feed is empty. If you’re signed out, open Subscriptions to sign in. If StopIt can’t verify a video or load the sidebar feed, you can retry or open Subscriptions.

Feed filtering uses YouTube’s desktop interface. Changes to that interface can require an extension update.

## Settings

On a phone, tap the **StopIt** icon inside YouTube. In desktop Chrome, select StopIt in the extensions menu. Turn on **Show notifications** to show the notification bell and open its panel in YouTube’s top bar. Turn on **Show Create button** to restore **Create** in the same bar. The bell and Create button are hidden by default. Each setting is saved independently and applies to open tabs.

### Strict mode

Turn on **Strict mode** in StopIt settings to group Home and the video sidebar into three sections. This setting is off by default. Each section lists videos newest first.

- **New** contains videos published since your previous visit. When you first turn on strict mode, it uses the activation time as the cutoff. This section opens first if it has videos. Its button is disabled when it’s empty.
- **Older** contains earlier uploads, including videos you never scrolled far enough to load. It opens when you arrive with no new videos or when the open **New** section becomes empty.
- **Watched** takes priority over the other sections. A video moves here when you open its player in an active, visible tab or when YouTube shows playback progress on its thumbnail. This includes videos opened from external links. Expand this section to return to a video you started.

One section is always open. Closing **New** or **Watched** opens **Older**. Each section scrolls independently. All three buttons stay visible, and returning to a section restores its scroll position. The controls adapt to light and dark themes and respect your reduced motion preference.

A visit counts when Subscriptions loads successfully in the foreground. Visits less than five minutes apart share the same cutoff, so reloading keeps your new videos together. Using Back restores that feed’s cutoff, even after a long video. Opening the sidebar preserves the time of your last visit to Home.

YouTube loads video cards as you scroll. StopIt sorts each batch locally using the dates, playback progress, and order already in the feed. It recognizes relative dates in English and Spanish. When two cards both say “1 hour ago,” the first videos from your previous visit help establish their order. When the available information is ambiguous, the video goes into **Older**.

Chrome stores visits and the IDs of the first videos in the feed and of watched videos locally for each YouTube account. Turning off strict mode restores the regular feed and pauses recording. Turning it on again keeps **Watched** and starts **New** from the time you enable it.

## Data and permissions

StopIt loads Subscriptions directly from YouTube using the tab’s active session. It keeps the video or Short classification for up to 512 video IDs in Chrome’s session storage. It requests access to the YouTube domains it uses for navigation and verification, and uses Chrome’s redirect rules before the player loads.

## License

StopIt uses the **MIT No Attribution (MIT-0)** license. You can use, copy, modify, redistribute, and sell the software, including without attribution. I share it as is, without warranties. You use it at your own risk. The license excludes liability for authors and copyright holders to the extent permitted by applicable law. [Full license](LICENSE)

## Run the tests

From the repository root, run these commands with Node.js 22 or later.

```sh
npm ci
npx playwright-core install chromium firefox webkit
npm test
```

After editing `mobile/src` or the shared modules in `extension`, run `npm run build:mobile` to regenerate `mobile/stopit.user.js`. The tests check that the installable file matches its sources.

The mobile tests run the userscript in WebKit and Firefox on sample pages that reproduce YouTube’s mobile navigation and feed.

To use an existing Chrome for Testing installation, set `CHROME_FOR_TESTING` to its executable path. The tests load the extension in a temporary profile and use sample YouTube pages with known dates. They cover localization, Home and sidebar ordering, live streams, pagination, strict mode, notifications, Shorts, navigation history, and verification errors.

## Publish a GitHub release

Tag the commit you want to release with `v` followed by the version in `extension/manifest.json`, for example `v3.2.0`, and push the tag. GitHub Actions verifies the version, packages the extension with its license, and tests the extracted ZIP and the mobile userscript. If the tests pass, it publishes the ZIP on GitHub Releases. Mobile managers fetch the userscript from `main` and detect updates using its own `@version` field in `mobile/src/metadata.txt`.
