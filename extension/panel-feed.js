// This entry point runs in the same-origin subscriptions frame created by watch-panel.js.
(() => {
  if (window === window.top) {
    location.replace('/feed/subscriptions');
    return;
  }
  const host = window.frameElement;
  if (!host?.closest('.stopit-watch-panel')) return;
  const currentId = () => StopItRoutes.videoId(new URL(parent.location.href));
  const cards = 'ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-video-renderer, .stopit-live';
  let grid;

  function status(value) {
    if (host.dataset.stopitState !== value) host.dataset.stopitState = value;
  }

  // The native page owns the feed, including pagination. Only its grid and
  // the ancestors needed to lay it out are exposed inside this viewport.
  function exposeGrid(next) {
    if (next === grid) return;
    document
      .querySelectorAll('[data-stopit-path]')
      .forEach((node) => node.removeAttribute('data-stopit-path'));
    grid?.removeAttribute('data-stopit-grid');
    grid = next;
    grid.setAttribute('data-stopit-grid', '');
    for (let node = grid; node && node !== document.documentElement; node = node.parentElement) {
      node.setAttribute('data-stopit-path', '');
    }
  }

  function markCurrent() {
    if (!grid) return;
    const id = currentId();
    for (const card of grid.querySelectorAll(cards)) {
      const link = card.querySelector(
        'h3 a[href], #video-title[href], a[href*="/watch?"], a[href^="/live/"]'
      );
      const current = Boolean(link && id && StopItRoutes.videoId(new URL(link.href)) === id);
      card.toggleAttribute('data-stopit-playing', current);
      if (link && current) link.setAttribute('aria-current', 'true');
      else link?.removeAttribute('aria-current');
    }
  }

  function emptyState() {
    const page = document.querySelector('ytd-browse[page-subtype="subscriptions"]:not([hidden])');
    const message = page?.querySelector(
      'ytd-background-promo-renderer, yt-background-promo-view-model, ytd-message-renderer'
    );
    if (!message) return false;
    const login =
      page.querySelector('a[href*="accounts.google.com/"], a[href^="/signin"]') ||
      document.querySelector('ytd-masthead a[href*="accounts.google.com/"]');
    status(login ? 'signedout' : 'empty');
    return true;
  }

  const initial = new MutationObserver(emptyState);
  initial.observe(document, { childList: true, subtree: true });
  globalThis.StopItPanelFeed = {
    updated(next) {
      initial.disconnect();
      exposeGrid(next);
      markCurrent();
      const hasVideos = [...grid.querySelectorAll(cards)].some((card) => card.getClientRects().length);
      if (!hasVideos && !grid.querySelector('ytd-continuation-item-renderer')) {
        if (!emptyState()) status('empty');
        return;
      }
      status('ready');
    }
  };

  // A card opens in the watch tab. Modified clicks keep the browser's normal
  // new-tab behavior and context menus retain the original YouTube links.
  window.addEventListener(
    'click',
    (event) => {
      const anchor = event.composedPath().find((node) => node instanceof HTMLAnchorElement);
      if (!anchor?.href || event.defaultPrevented || event.button !== 0) return;
      const url = new URL(anchor.href);
      if (url.origin !== location.origin || url.pathname === '/feed/subscriptions') return;
      event.stopImmediatePropagation();
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      parent.location.assign(url.href);
    },
    true
  );
  navigation.addEventListener('navigate', (event) => {
    const url = new URL(event.destination.url);
    if (url.origin === location.origin && url.pathname === '/feed/subscriptions') return;
    if (event.cancelable) event.preventDefault();
    if (url.origin === location.origin && event.userInitiated && StopItRoutes.videoId(url)) {
      parent.location.assign(url.href);
    } else {
      status('error');
    }
  });
})();
