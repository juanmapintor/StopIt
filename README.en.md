# StopIt for YouTube

[Leer en español](README.md)

StopIt is a desktop Chrome extension that puts the channels you subscribe to on YouTube Home and beside the video player. It hides Shorts throughout YouTube and takes you to Subscriptions when you open one.

## Install in Chrome

You need Chrome 120 or later and a local copy of this repository.

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Select **Load unpacked** and choose the `extension` folder containing `manifest.json`.
4. Reload any open YouTube tabs. StopIt uses the YouTube account signed in to that Chrome profile.

To check the installation, open YouTube Home. The address changes to `/feed/subscriptions`. After updating the extension files, click the reload button for StopIt on the extensions page, then reload YouTube.

StopIt follows Chrome’s display language. Its settings, section names, and messages appear in Spanish for all Spanish regional variants. It uses English for every other language. YouTube displays its own content and controls in the language you chose on the site.

## What you’ll see on YouTube

- **Home and Subscriptions.** Videos appear newest first. StopIt filters out recommendation shelves, Shorts, scheduled premieres, and cards for ads, playlists, and mixes in the subscription feed. Live streams appear in order of their start time when YouTube provides it. Otherwise, they keep their place in the feed. Replays appear by publication date. Scroll down to load more videos.
- **Shorts.** StopIt hides the sidebar shortcut, Shorts rows in the feed, and entire Shorts shelves in search results, including shelves added as you scroll. It also hides the Shorts filter or tab in History, playlists, Watch Later, Liked videos, search, and channel pages.
- **Beside the player.** The sidebar shows the same subscription feed in the same order, even when you open a video from an external link. Scroll inside the panel to load more. The current video carries a **Now playing** label if it appears in the feed. Selecting another video opens it in the main tab. You can also use its link menu to open it in a new tab. When you scroll through comments, the sidebar stays below YouTube’s top bar and fills the available height, including in Theater mode. Live chat and the playlist queue remain accessible.
- **Shared links.** A direct Shorts link opens Subscriptions. For an ambiguous video link, StopIt checks the video’s metadata before opening it. This includes links to the embedded player that you open as a page in a tab. Regular videos retain the link’s playlist parameters and timestamp.
- **Loading and errors.** The panel shows a loading indicator and tells you when the feed is empty. If you’re signed out, open Subscriptions to sign in. If StopIt can’t verify a video or load the sidebar feed, you can retry or open Subscriptions.

Feed filtering uses YouTube’s desktop interface. Changes to that interface can require an extension update.

## Settings

Select StopIt in Chrome’s extensions menu. Turn on **Show notifications** to show the notification bell and open its panel in YouTube’s top bar. Both are hidden by default. Chrome saves your choice in this profile and applies it to open tabs.

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

## Run the tests

From the repository root, run these commands with Node.js 22 or later.

```sh
npm ci
npx playwright-core install chromium
npm test
```

To use an existing Chrome for Testing installation, set `CHROME_FOR_TESTING` to its executable path. The tests load the extension in a temporary profile and use sample YouTube pages with known dates. They cover localization, Home and sidebar ordering, live streams, pagination, strict mode, notifications, Shorts, navigation history, and verification errors.
