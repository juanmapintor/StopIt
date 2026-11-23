(() => {
  const { subscriptions, videoId } = StopItRoutes;
  const initialURL = new URL(location.href);
  const initialVideo = videoId(initialURL);
  let leaving = false;

  function destination(url) {
    if (url.origin !== location.origin) return null;
    if (url.pathname === '/' || /^\/(?:shorts|feed\/(?:subscriptions\/)?shorts)(?:\/|$)/.test(url.pathname)) {
      return subscriptions;
    }
    if (videoId(url) && videoId(url) !== initialVideo) {
      return url.href;
    }
    return null;
  }

  function leave(url, replace) {
    if (leaving || (location.href === url && !replace)) return;
    leaving = true;
    document.documentElement?.setAttribute('data-stopit-leaving', '');
    for (const player of document.querySelectorAll('audio, video')) player.pause();
    if (replace) location.replace(url);
    else location.assign(url);
  }

  function intercept(event, raw) {
    const url = URL.parse ? URL.parse(raw, location.href) : new URL(raw, location.href);
    const target = url && destination(url);
    if (!target || !event.cancelable) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (target !== location.href) leave(target, false);
  }

  window.addEventListener(
    'click',
    (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor = event.composedPath().find((node) => node instanceof HTMLAnchorElement);
      if (anchor?.href && (!anchor.target || anchor.target === '_self') && !anchor.hasAttribute('download')) {
        intercept(event, anchor.href);
      }
    },
    true
  );

  navigation.addEventListener('navigate', (event) => {
    if (event.destination.sameDocument) intercept(event, event.destination.url);
  });

  // Also catch history traversals that Chrome does not let a navigate listener cancel.
  function checkLocation() {
    const target = destination(new URL(location.href));
    if (target) leave(target, true);
  }
  navigation.addEventListener('currententrychange', checkLocation);
  window.addEventListener('pageshow', () => {
    leaving = false;
    document.documentElement?.removeAttribute('data-stopit-leaving');
    checkLocation();
  });
  document.addEventListener(
    'play',
    (event) => {
      if (leaving && event.target instanceof HTMLMediaElement) event.target.pause();
    },
    true
  );
  checkLocation();
})();
