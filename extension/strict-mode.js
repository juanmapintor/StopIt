const StopItStrictMode = (() => {
  const embedded = window !== window.top;
  // Only the same-origin subscriptions iframe loads this entry point.
  const host = embedded ? parent : window;
  let since = 0;
  let account;
  let visit;
  let lastOpened;
  const seen = new Map();
  let traversal = performance.getEntriesByType('navigation')[0]?.type === 'back_forward';

  function accountId() {
    if (account) return account;
    // Read the active account from the page bootstrap, never the video author's channel.
    for (const script of [...document.querySelectorAll('script:not([src])')].reverse()) {
      const config = script.textContent;
      if (!config.includes('ytcfg.set(') || !/"LOGGED_IN"\s*:/.test(config)) continue;
      if (!/"LOGGED_IN"\s*:\s*true/.test(config)) return null;
      const field = (key) => config.match(new RegExp('"' + key + '"\\s*:\\s*"([\\w.|-]+)"'))?.[1];
      account = field('DATASYNC_ID') || field('DELEGATED_SESSION_ID') || field('USER_SESSION_ID');
      if (!account) {
        for (const data of document.querySelectorAll('script:not([src])')) {
          if (!data.textContent.includes('ytInitialData')) continue;
          account = data.textContent.match(/"datasyncId"\s*:\s*"([\w.|-]+)"/)?.[1];
          if (account) break;
        }
      }
      if (account && /[\w]/.test(account)) return account;
      account = undefined;
    }
    return null;
  }

  function refresh() {
    document.dispatchEvent(new Event('stopit-strict-update'));
  }

  async function request(action, extra = {}) {
    return StopItPlatform.strict({ action, account, since, ...extra });
  }

  function recordOpening() {
    if (!since || embedded || document.hidden) return;
    const id = StopItRoutes.videoId(new URL(location.href));
    if (!StopItRoutes.validId(id) || id === lastOpened) return;
    if (document.documentElement.hasAttribute('data-stopit-verifying')) return;
    const player = document.querySelector('#movie_player, #player-container-id:has(video)');
    const video = player?.querySelector('video');
    if (!video || video.readyState < HTMLMediaElement.HAVE_METADATA || video.error) return;
    const playingId = player.closest('ytd-watch-flexy, ytd-watch-grid')?.getAttribute('video-id');
    if ((playingId && id !== playingId) || !accountId()) return;
    const generation = since;
    const owner = account;
    request('opened', { id }).then((written) => {
      if (written && generation === since && owner === account) lastOpened = id;
    }).catch(console.error);
  }

  function visitContext(entry) {
    const entries = StopItPlatform.navigationFor(host).entries();
    const previous = entries[entry.index - 1];
    const url = previous?.url && new URL(previous.url);
    const fromFeed = url && (url.pathname === '/feed/subscriptions' || StopItRoutes.videoId(url));
    return {
      entry: entry.key, historyKeys: entries.map((item) => item.key),
      restore: traversal, source: embedded && fromFeed ? previous.key : null
    };
  }

  function hasProgress(card) {
    const bar = card.querySelector(
      'ytd-thumbnail-overlay-resume-playback-renderer #progress, ytm-thumbnail-overlay-resume-playback-renderer .thumbnail-overlay-resume-playback-progress, ' +
      '.ytwThumbnailOverlayResumePlaybackRendererThumbnailOverlayResumePlaybackProgress, ' +
      '.ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment'
    );
    if (!bar) return false;
    const amount = bar.getAttribute('aria-valuenow') || bar.style.width;
    return amount ? parseFloat(amount) > 0 : bar.getBoundingClientRect().width > 0;
  }

  let sections;
  function clear(grid) {
    if (!grid) return;
    if (sections?.grid === grid) {
      sections.destroy();
      sections = null;
    }
    for (const el of grid.querySelectorAll('[data-stopit-heading]')) el.remove();
    for (const el of grid.querySelectorAll('[data-stopit-group]')) el.removeAttribute('data-stopit-group');
    for (const name of ['strict-grid', 'strict-problem', 'past-cutoff', 'classifying']) {
      grid.removeAttribute('data-stopit-' + name);
    }
  }

  function unavailable(grid, message) {
    if (grid.querySelector('[data-stopit-heading="problem"]')?.textContent === message) return;
    clear(grid);
    const notice = document.createElement('p');
    notice.lang = StopItPlatform.message('languageCode');
    notice.dataset.stopitHeading = 'problem';
    notice.setAttribute('role', 'status');
    notice.textContent = message;
    grid.setAttribute('data-stopit-strict-problem', '');
    grid.prepend(notice);
  }

  async function groupFeed({ state, mounted, inspected, current }) {
    if (!since) return;
    if (!accountId()) {
      if (mounted.size || state.lives.size) unavailable(state.grid, StopItPlatform.message('strictAccountError'));
      else clear(state.grid);
      return;
    }
    const epoch = since;
    const owner = account;
    const entry = StopItPlatform.navigationFor(host).currentEntry;
    if (!entry) return;
    const valid = () => epoch === since && owner === account && entry.key === StopItPlatform.navigationFor(host).currentEntry?.key && current();
    const items = new Map(mounted);
    for (const [id, live] of state.lives) {
      if (state.grid.contains(live.tile)) items.set(id, live.tile);
    }
    if (!items.size) {
      clear(state.grid);
      return;
    }

    // A history entry keeps its own cutoff across Back, even after a long video.
    const snapshot = visit?.entry === entry.key ? visit : await request('preview', visitContext(entry));
    if (!valid() || !snapshot) return;
    const { cutoff } = snapshot;
    if (snapshot.pinned) visit = snapshot;
    const prefix = 'strictSeen:' + account + ':';
    const missing = [...items.keys()].filter(id => !seen.has(id));
    if (missing.length) {
      const stored = await StopItPlatform.local.get(missing.map(id => prefix + id));
      if (!valid()) return;
      // A storage event can deliver a newer value while this read is in flight.
      for (const id of missing) {
        if (!seen.has(id)) seen.set(id, stored[prefix + id] === true);
      }
    }
    const progressed = new Set();
    for (const item of inspected) {
      if (items.has(item.id) && hasProgress(item.card)) progressed.add(item.id);
    }
    const remember = [...progressed].filter((id) => !seen.get(id));
    if (remember.length) await request('progress', { ids: remember });
    if (!valid()) return;

    if (!snapshot.pinned && !embedded && !document.hidden) {
      const result = await request('visit', { ...visitContext(entry), cutoff, head: state.order.slice(0, 12) });
      if (!valid() || !result) return;
      if (result.cutoff !== cutoff) {
        // Another tab advanced the visit during classification. Recompute before committing.
        refresh();
        return;
      }
      if (result.pinned) visit = result;
    }
    // The native uploads are chronological. An upload above the previous
    // feed head arrived since that visit, even when both say “hace 1 h”.
    const anchors = new Set(snapshot.anchors);
    const boundary = state.order.findIndex(id => anchors.has(id));
    const aboveHead = boundary < 0 ? null : new Set(state.order.slice(0, boundary));
    let newCount = 0;
    let pastCutoff = false;
    const grid = state.grid;
    grid.querySelector('[data-stopit-heading="problem"]')?.remove();
    for (const [id, card] of items) {
      const date = state.dates.get(id);
      // Native dates take precedence for old backfilled uploads. Use feed
      // order when the label is missing or its interval straddles the cutoff.
      const uncertain = !date || (date.earliest <= cutoff && cutoff < date.latest);
      const isNew = uncertain ? aboveHead?.has(id) : date.earliest > cutoff;
      if (!isNew && state.known.has(id)) pastCutoff = true;
      const group = seen.get(id) || progressed.has(id) ? 'seen' : isNew ? 'new' : 'older';
      card.dataset.stopitGroup = group;
      if (group === 'new') newCount++;
    }
    grid.removeAttribute('data-stopit-strict-problem');
    grid.toggleAttribute('data-stopit-past-cutoff', pastCutoff || newCount === 0);
    if (!sections) sections = new StopItSections(grid);
    sections.update(newCount > 0);
  }

  function onVisible() {
    if (document.hidden) return;
    seen.clear();
    recordOpening();
    refresh();
  }
  function onPageData() {
    const previous = account;
    account = null;
    if (accountId() !== previous) {
      visit = lastOpened = null;
      seen.clear();
      document.querySelectorAll('[data-stopit-strict-grid], [data-stopit-strict-problem]').forEach(clear);
      if (previous) document.dispatchEvent(new Event('stopit-account-changed'));
    }
    recordOpening();
    refresh();
  }
  StopItPlatform.onActive(() => {
    if (since) onVisible();
  });
  function onEntry(event) {
    if (event.type === 'popstate') traversal = true;
    if (event.navigationType === 'traverse' || event.navigationType === 'push') {
      traversal = event.navigationType === 'traverse';
    }
    recordOpening();
    refresh();
  }
  StopItPreferences.observe('strictSince', (value) => {
    const next = Number.isSafeInteger(value) && value > 0 ? value : 0;
    if (next === since) return;
    since = next;
    visit = lastOpened = account = null;
    seen.clear();
    for (const [target, event, listener] of [
      [document, 'visibilitychange', onVisible], [window, 'focus', onVisible],
      [document, 'stopit-video-verified', recordOpening], [document, 'loadedmetadata', recordOpening], [document, 'loadeddata', recordOpening],
      [document, 'yt-navigate-finish', onPageData], [document, 'yt-page-data-updated', onPageData],
      [window, 'pageshow', onVisible], [window.navigation || window, window.navigation ? 'currententrychange' : 'popstate', onEntry]
    ]) {
      if (since) target.addEventListener(event, listener, true);
      else target.removeEventListener(event, listener, true);
    }
    if (!since) document.querySelectorAll('[data-stopit-strict-grid], [data-stopit-strict-problem]').forEach(clear);
    else recordOpening();
    refresh();
  });
  StopItPlatform.local.onChanged.addListener((changes) => {
    if (!since || !account) return;
    const prefix = 'strictSeen:' + account + ':';
    let changed = false;
    for (const [key, change] of Object.entries(changes)) {
      if (!key.startsWith(prefix)) continue;
      seen.set(key.slice(prefix.length), change.newValue === true);
      changed = true;
    }
    if (changed) refresh();
  });
  return {
    groupFeed, clear, unavailable,
    get enabled() { return Boolean(since) && (!embedded || Boolean(window.frameElement?.closest('.stopit-watch-panel'))); },
  };
})();
