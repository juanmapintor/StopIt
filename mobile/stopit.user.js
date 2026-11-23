// ==UserScript==
// @name         StopIt for YouTube
// @namespace    https://github.com/juanmapintor/StopIt
// @version      1.0.0
// @description  Open Subscriptions on Home, hide Shorts, and return to your feed from the player.
// @description:es Abrí Suscripciones desde Inicio, ocultá Shorts y volvé a tu feed desde el reproductor.
// @license      MIT-0
// @match        https://m.youtube.com/*
// @match        https://www.youtube.com/*
// @match        https://youtube.com/*
// @run-at       document-start
// @inject-into  content
// @noframes
// @grant        none
// @updateURL    https://raw.githubusercontent.com/juanmapintor/StopIt/main/mobile/stopit.user.js
// @downloadURL  https://raw.githubusercontent.com/juanmapintor/StopIt/main/mobile/stopit.user.js
// ==/UserScript==

(() => {
  'use strict';
  const subscriptions = '/feed/subscriptions';
  const origins = new Set(['https://m.youtube.com', 'https://www.youtube.com', 'https://youtube.com']);
  if (window !== window.top || !origins.has(location.origin)) return;

  const shortRoute = /^\/(?:shorts|feed\/(?:subscriptions\/)?shorts)(?:\/|$)/;
  const shortLink = 'a:is([href^="/shorts/"], [href^="https://m.youtube.com/shorts/"], [href^="https://www.youtube.com/shorts/"])';
  const lockups = 'ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2';
  const style = document.createElement('style');
  style.textContent = `
    ytm-reel-shelf-renderer, ytd-reel-shelf-renderer, ${lockups},
    ytm-pivot-bar-item-renderer:has(.pivot-shorts, a[href="/shorts"], ${shortLink}),
    :is(ytm-rich-section-renderer, ytd-rich-section-renderer, grid-shelf-view-model):has(
      ytm-reel-shelf-renderer, ytd-reel-shelf-renderer, ${lockups}, ${shortLink}
    ):not(:has(a[href^="/watch"], a[href^="/live/"])),
    :is(ytm-rich-item-renderer, ytm-video-with-context-renderer, ytm-compact-video-renderer,
      ytm-video-renderer, ytm-playlist-video-renderer, ytd-rich-item-renderer, ytd-video-renderer,
      yt-lockup-view-model):has(${shortLink}, ${lockups}, [data-style="SHORTS"], [overlay-style="SHORTS"]),
    :is(ytm-pivot-bar-item-renderer, ytm-chip-cloud-chip-renderer, ytd-guide-entry-renderer,
      ytd-mini-guide-entry-renderer):has([aria-label="Shorts" i], [title="Shorts" i]),
    [role="tab"][aria-label="Shorts" i], .single-column-browse-results-tabs a[href$="/shorts"],
    html[data-stopit-mobile-leaving] :is(video, #player-container-id, #movie_player),
    ytm-watch ytm-item-section-renderer:is([section-identifier="related-items"], [data-content-type="related"]) {
      display: none !important;
    }
    #stopit-mobile-subscriptions {
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      min-height: 44px;
      margin: 8px 12px;
      padding: 8px 16px;
      border-radius: 24px;
      color: var(--yt-spec-text-primary, inherit);
      background: var(--yt-spec-badge-chip-background, rgba(128, 128, 128, .18));
      font: 600 15px/1.4 system-ui, sans-serif;
      text-decoration: none;
    }
    #stopit-mobile-subscriptions:focus-visible { outline: 2px solid currentColor; }
  `;

  function videoId(url) {
    if (!/^\/watch\/?$/.test(url.pathname)) {
      return url.pathname.match(/^\/live\/([\w-]{11})\/?$/)?.[1] || null;
    }
    const id = url.searchParams.get('v');
    return /^[\w-]{11}$/.test(id || '') ? id : null;
  }

  const initialVideo = videoId(new URL(location.href));
  const returnLink = document.createElement('a');
  returnLink.id = 'stopit-mobile-subscriptions';
  returnLink.href = subscriptions;
  const spanish = /^es(?:-|$)/i.test(navigator.language);
  returnLink.lang = spanish ? 'es' : 'en';
  returnLink.textContent = spanish ? 'Volver a mis suscripciones' : 'Back to my subscriptions';
  let leaving = false;
  let renderRequest = 0;

  function pausePlayers() {
    document.documentElement?.setAttribute('data-stopit-mobile-leaving', '');
    for (const media of document.querySelectorAll('video, audio')) media.pause();
  }

  function leave(url, replace) {
    if (leaving) return;
    leaving = true;
    pausePlayers();
    if (replace) location.replace(url);
    else location.assign(url);
  }

  function canonicalShort(id) {
    const href = document.head?.querySelector('link[rel~="canonical"]')?.href;
    if (!href) return false;
    try {
      const url = new URL(href);
      return origins.has(url.origin) && url.pathname.replace(/\/$/, '') === '/shorts/' + id;
    } catch {
      return false;
    }
  }

  function checkDocument() {
    if (!style.isConnected && document.documentElement) {
      (document.head || document.documentElement).append(style);
    }
    const url = new URL(location.href);
    if (leaving) return;
    if (url.pathname === '/' || shortRoute.test(url.pathname)) {
      leave(subscriptions, true);
      return;
    }
    const id = videoId(url);
    if (id && id !== initialVideo) {
      // A same-document transition can retain the previous video's canonical URL.
      // Load this watch URL once to get its own metadata, including on Back/Forward.
      leaving = true;
      pausePlayers();
      location.reload();
      return;
    }
    if (id && canonicalShort(id)) {
      leave(subscriptions, true);
      return;
    }
    if (!id) {
      returnLink.remove();
      return;
    }
    if (!renderRequest && !returnLink.isConnected) renderRequest = requestAnimationFrame(attachReturnLink);
  }

  function attachReturnLink() {
    renderRequest = 0;
    if (leaving || !videoId(new URL(location.href))) return;
    // The mobile player is fixed. The watch content below its placeholder scrolls normally.
    const belowPlayer = document.querySelector(
      'ytm-watch .watch-below-the-player, ytm-single-column-watch-next-results-renderer, ' +
      'ytd-watch-flexy:not([hidden]) #below, ytd-watch-grid:not([hidden]) #below'
    );
    belowPlayer?.prepend(returnLink);
  }

  window.addEventListener('click', (event) => {
    if (!event.cancelable || event.defaultPrevented || event.button !== 0 ||
        event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const link = event.composedPath().find(node => node instanceof HTMLAnchorElement);
    if (!link?.href || (link.target && link.target !== '_self') || link.hasAttribute('download')) return;
    if (!origins.has(link.origin)) return;
    const url = new URL(link.href);
    const toFeed = url.pathname === '/' || shortRoute.test(url.pathname);
    const id = videoId(url);
    if (!toFeed && (!id || id === initialVideo)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (toFeed && location.pathname === subscriptions) return;
    leave(toFeed ? subscriptions : url.href, false);
  }, true);

  document.addEventListener('play', (event) => {
    if (event.target instanceof HTMLMediaElement) {
      checkDocument();
      if (leaving) event.target.pause();
    }
  }, true);
  new MutationObserver(checkDocument).observe(document, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['rel', 'href']
  });
  window.navigation?.addEventListener('currententrychange', checkDocument);
  document.addEventListener('yt-navigate-finish', checkDocument);
  window.addEventListener('popstate', checkDocument);
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      leaving = false;
      document.documentElement?.removeAttribute('data-stopit-mobile-leaving');
    }
    checkDocument();
  });
  checkDocument();
})();
