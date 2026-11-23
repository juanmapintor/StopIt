(() => {
  'use strict';
  const subscriptions = '/feed/subscriptions';
  const origins = new Set(['https://m.youtube.com', 'https://www.youtube.com', 'https://youtube.com']);
  if (window !== window.top || !origins.has(location.origin)) return;

  const videoId = url => {
    const id = StopItRoutes.videoId(url);
    return StopItRoutes.validId(id) ? id : null;
  };
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

  const t = StopItPlatform.message;
  let verifiedId;
  let verifying;
  let verificationFailed = false;
  let interrupted;
  const gate = document.createElement('section');
  gate.id = 'stopit-verification';
  gate.lang = t('languageCode');
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const retry = document.createElement('button');
  retry.textContent = t('retry');
  retry.onclick = () => location.reload();
  const openFeed = document.createElement('a');
  openFeed.href = subscriptions;
  openFeed.textContent = t('goToSubscriptions');
  gate.append(status, retry, openFeed);

  function showGate(failed) {
    document.documentElement?.setAttribute('data-stopit-verifying', '');
    const message = t(failed ? 'checkFailed' : 'checkingVideo');
    if (status.textContent !== message) status.textContent = message;
    retry.hidden = !failed;
    openFeed.hidden = !failed;
    if (document.body && !gate.isConnected) document.body.append(gate);
    for (const media of document.querySelectorAll('video, audio')) {
      if (!media.paused) {
        interrupted = media;
        media.pause();
      }
    }
  }

  function releaseGate(id) {
    verifiedId = id;
    document.documentElement?.removeAttribute('data-stopit-verifying');
    gate.remove();
    if (interrupted?.isConnected && id) interrupted.play().catch(() => {});
    interrupted = null;
    if (id) document.dispatchEvent(new Event('stopit-video-verified'));
  }

  function verify(id) {
    const canonical = document.head?.querySelector('link[rel~="canonical"]')?.href;
    if (canonical) {
      try {
        const url = new URL(canonical);
        if (origins.has(url.origin) && url.pathname.replace(/\/$/, '') === '/shorts/' + id) {
          leave(subscriptions, true);
          return false;
        }
        if (origins.has(url.origin) && videoId(url) === id && url.pathname === '/watch' &&
            Number.isFinite(Date.parse(document.querySelector('meta[itemprop="datePublished"]')?.content))) {
          if (verifiedId !== id) releaseGate(id);
          return true;
        }
      } catch { /* Fall back to YouTube's watch document. */ }
    }
    if (verifiedId === id) return true;
    showGate(verificationFailed);
    if (document.readyState === 'loading' || verifying === id || verificationFailed) return false;
    verifying = id;
    StopItMetadata.identify(id, location.origin).then(kind => {
      if (leaving || videoId(new URL(location.href)) !== id) return;
      if (kind === 'short') leave(subscriptions, true);
      else { releaseGate(id); checkDocument(); }
    }).catch(() => {
      if (!leaving && verifiedId !== id && videoId(new URL(location.href)) === id) {
        verificationFailed = true;
        showGate(true);
      }
    });
    return false;
  }

  function checkDocument() {
    const url = new URL(location.href);
    if (leaving) return;
    if (isLanding()) { routeLanding(); return; }
    const id = videoId(url);
    if (id && id !== initialVideo) {
      // A same-document transition can retain the previous video's canonical URL.
      // Load this watch URL once to get its own metadata, including on Back/Forward.
      leaving = true;
      pausePlayers();
      location.reload();
      return;
    }
    if (id && !verify(id)) return;
    if (!id) {
      if (gate.isConnected || verifiedId) releaseGate(null);
      verifying = null;
      verificationFailed = false;
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
      if (leaving || isLanding()) event.target.pause();
    }
  }, true);
  new MutationObserver(checkDocument).observe(document, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['rel', 'href']
  });
  window.navigation?.addEventListener('currententrychange', checkDocument);
  document.addEventListener('yt-navigate-finish', checkDocument);
  document.addEventListener('DOMContentLoaded', checkDocument);
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
