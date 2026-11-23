(() => {
  const feedRoute = '/feed/subscriptions';
  const pageSelector = 'ytd-browse[page-subtype="subscriptions"]:not([hidden])';
  const grids =
    'ytd-rich-grid-renderer > #contents, ytd-grid-renderer > #items, ytd-section-list-renderer > #contents';
  const cardTypes = 'ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-video-renderer, ' +
    'ytm-rich-item-renderer, ytm-video-with-context-renderer, ytm-compact-video-renderer, ytm-video-renderer, yt-lockup-view-model';
  const shelf =
    'ytd-rich-section-renderer, ytd-rich-shelf-renderer, ytd-shelf-renderer, grid-shelf-view-model, ytd-reel-shelf-renderer, ytm-shelf-renderer, ytm-rich-section-renderer, ytm-reel-shelf-renderer';
  const videoLink = 'a:is([href^="/watch?"], [href^="/live/"], [href^="https://www.youtube.com/watch?"], [href^="https://m.youtube.com/watch?"])';
  const titleSelector = 'h3 a, #video-title, #video-title-link, .media-item-headline, .compact-media-item-headline, ' +
    '.ytLockupMetadataViewModelTitle, .yt-lockup-metadata-view-model__title, a[href] :is(h3, h4)';
  const mobileLists = '.rich-grid-renderer-contents, ytm-section-list-renderer > lazy-list';
  const badgeLabels =
    'yt-thumbnail-badge-view-model :is(.ytBadgeShapeText, .yt-badge-shape__text), ytd-thumbnail-overlay-time-status-renderer #text, ytm-thumbnail-overlay-time-status-renderer';
  let active = null;
  let timer;

  // YouTube sometimes recycles the mounted cards when the user scrolls.
  // Remember their native order so an old live stream is inserted only once.
  function mergeWindow(state, ids) {
    if (ids.every((id) => state.known.has(id))) return;
    const pending = [];
    let previous = null;
    for (const id of ids) {
      if (!state.known.has(id)) {
        pending.push(id);
        state.known.add(id);
      } else {
        if (pending.length) {
          state.order.splice(state.order.indexOf(id), 0, ...pending);
          pending.length = 0;
        }
        previous = id;
      }
    }
    if (pending.length) {
      const index = previous ? state.order.indexOf(previous) + 1 : state.order.length;
      state.order.splice(index, 0, ...pending);
    }
  }

  function cardType(card) {
    if (card.querySelector('a[href^="/shorts/"], [overlay-style="SHORTS"], [data-style="SHORTS"]')) return 'skip';
    const labels = Array.from(card.querySelectorAll(badgeLabels), (n) => n.textContent.trim()).filter(
      Boolean
    );
    if (
      card.querySelector('[overlay-style="UPCOMING"], [data-style="UPCOMING"], ytm-ad-slot-renderer, ytm-playlist-renderer, ytm-radio-renderer, ytm-compact-playlist-renderer, ytm-compact-radio-renderer') ||
      labels.some((s) => /^(upcoming|premiere|próximamente|programado|estreno)$/i.test(s))
    )
      return 'skip';
    if (
      card.querySelector(
        '[overlay-style="LIVE"], [data-style="LIVE"], .badge-style-type-live-now, .yt-badge-shape--thumbnail-live, .ytBadgeShapeThumbnailLive'
      ) ||
      labels.some((s) => /^(live|live now|en vivo|en directo|directo)$/i.test(s))
    )
      return 'live';
    return 'ordinary';
  }

  function liveTile(card, id, headline) {
    const tile = document.createElement('div');
    tile.className = 'stopit-live';
    const link = document.createElement('a');
    link.href = '/watch?v=' + id;
    const preview = document.createElement('span');
    preview.className = 'preview';
    const image = document.createElement('img');
    image.alt = '';
    image.loading = 'lazy';
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.lang = StopItPlatform.message('languageCode');
    badge.textContent = StopItPlatform.message('liveBadge');
    const title = document.createElement('strong');
    title.textContent =
      headline?.textContent.trim() ||
      card.querySelector(videoLink)?.getAttribute('aria-label') ||
      StopItPlatform.message('watchLive');
    const channel = document.createElement('span');
    channel.className = 'channel';
    channel.textContent = card.querySelector('a[href^="/@"], ytd-channel-name a')?.textContent.trim() || '';
    preview.append(image, badge);
    link.append(preview, title, channel);
    tile.append(link);
    return tile;
  }

  function setHidden(card, hidden) {
    card.toggleAttribute('data-stopit-hidden', hidden);
  }

  async function applyFeed(state) {
    const cards = [...state.grid.querySelectorAll(cardTypes)].filter(card => !card.closest(shelf) && !card.parentElement.closest(cardTypes));
    // Some layouts put broadcasts in a separate Live shelf. Never use a
    // recommendation shelf as a source, even if one of its picks is live.
    const liveShelfCards = new Set();
    for (const section of state.grid.querySelectorAll(shelf)) {
      const label = section.querySelector('h2, #title, [role="heading"]')?.textContent.trim();
      if (!/^(en directo|en vivo|directos|emisiones en directo|live|live now|live streams)$/i.test(label))
        continue;
      for (const link of section.querySelectorAll(videoLink)) {
        const card = link.closest(cardTypes + ', yt-lockup-view-model, .yt-lockup-view-model');
        if (card) liveShelfCards.add(card);
      }
    }
    cards.push(...liveShelfCards);
    const mounted = new Map();
    const inspected = [];
    const ordinaryIds = [];
    const projectedIds = new Set();
    for (const card of cards) {
      const link = card.querySelector(videoLink);
      const id = link && StopItRoutes.videoId(new URL(link.href));
      const title = card.querySelector(titleSelector);
      if (!StopItRoutes.validId(id) || !(title?.textContent.trim() || link.getAttribute('aria-label') || (!link.firstElementChild && link.textContent.trim()))) {
        // YouTube is still filling this slot, or has just recycled it.
        card.removeAttribute('data-stopit-group');
        setHidden(card, false);
        continue;
      }
      const type = cardType(card);
      const inShelf = liveShelfCards.has(card);
      const live = type === 'live';
      if (inShelf && (!live || mounted.has(id) || projectedIds.has(id))) continue;
      const date = StopItFeedDates.read(card, live, state.dates.get(id), title);
      if (date) state.dates.set(id, date);
      inspected.push({ id, card });
      // An undated live broadcast keeps its native position and renderer.
      // Only project a tile when it must move out of a shelf or to a dated slot.
      const project = live && (inShelf || date);
      if (project) {
        projectedIds.add(id);
        const tile = state.lives.get(id)?.tile || liveTile(card, id, title);
        const thumbnail = card.querySelector('img');
        const src = thumbnail?.currentSrc || thumbnail?.getAttribute('src') || thumbnail?.dataset.thumb;
        const image = tile.querySelector('img');
        if (src && src !== image.getAttribute('src')) image.src = src;
        state.lives.set(id, { tile, started: date?.latest });
      }
      const hidden = type === 'skip' || projectedIds.has(id) || mounted.has(id);
      setHidden(card, hidden);
      if (!hidden) {
        mounted.set(id, card);
        if (!live) ordinaryIds.push(id);
      }
    }
    for (const [id, live] of state.lives) {
      if (!projectedIds.has(id)) {
        live.tile.remove();
        state.lives.delete(id);
      }
    }
    // A recycled slot may get its live/upcoming badge after its watch link.
    const ordinary = new Set(ordinaryIds);
    for (const { id } of inspected) {
      if (!ordinary.has(id)) state.known.delete(id);
    }
    if (state.order.length !== state.known.size) state.order = state.order.filter(id => state.known.has(id));
    mergeWindow(state, ordinaryIds);

    const placements = new Map();
    const lives = [...state.lives.values()].sort((a, b) =>
      (b.started ?? Number.MAX_SAFE_INTEGER) - (a.started ?? Number.MAX_SAFE_INTEGER)
    );
    for (const live of lives) {
      let index = 0;
      if (live.started != null) {
        index = state.order.findIndex(id => state.dates.get(id)?.latest < live.started);
        if (index < 0) index = state.order.length;
      }
      const anchor = mounted.get(state.order[index]);
      const atTail = index === state.order.length && (!state.order.length || mounted.has(state.order.at(-1)));
      if (!anchor && !atTail) {
        live.tile.remove();
        continue;
      }
      const before = anchor || state.grid.querySelector(':scope > ytd-continuation-item-renderer');
      if (!placements.has(before)) placements.set(before, []);
      placements.get(before).push(live.tile);
    }
    for (const [anchor, tiles] of placements) {
      let before = anchor;
      const parent = before?.parentElement || state.grid;
      for (const tile of tiles.reverse()) {
        if (tile.parentElement !== parent || tile.nextElementSibling !== before)
          parent.insertBefore(tile, before);
        before = tile;
      }
    }
    if (StopItStrictMode.enabled) {
      const current = () => state === active && state.grid.isConnected;
      const loading = setTimeout(() => {
        if (current() && StopItStrictMode.enabled) state.grid.setAttribute('data-stopit-classifying', '');
      }, 150);
      try {
        await StopItStrictMode.groupFeed({ state, mounted, inspected, current });
      } catch (error) {
        if (current() && StopItStrictMode.enabled) {
          StopItStrictMode.unavailable(state.grid, StopItPlatform.message('strictLoadError'));
          console.error(error);
        }
      } finally {
        clearTimeout(loading);
        state.grid.removeAttribute('data-stopit-classifying');
      }
      if (!current()) return;
    }
    StopItPlatform.panelFeed?.updated(state.grid);
  }

  function schedule() {
    const state = active;
    if (!state) return;
    if (state.running) {
      state.dirty = true;
      return;
    }
    if (timer) return;
    timer = setTimeout(async () => {
      timer = null;
      state.running = true;
      try {
        await applyFeed(state);
      } catch (error) {
        console.error(error);
      } finally {
        state.running = false;
        if (state === active && state.dirty) {
          state.dirty = false;
          schedule();
        }
      }
    }, 40);
  }

  const gridObserver = new MutationObserver((records) => {
    if (
      records.some(
        (record) =>
          record.type === 'attributes' && ['style', 'aria-valuenow'].includes(record.attributeName)
            ? StopItStrictMode.enabled && record.target.matches('#progress, [role="progressbar"], [class*="ProgressBar"], [class*="PlaybackProgress"]')
            : record.type !== 'childList' || [...record.addedNodes, ...record.removedNodes].some(
                (node) => !node.classList?.contains('stopit-live') && !node.hasAttribute?.('data-stopit-heading')
              )
      )
    )
      schedule();
  });
  function observeGrid() {
    const attributeFilter = ['href', 'overlay-style', 'data-style', 'aria-label', 'datetime', 'content', 'src'];
    if (StopItStrictMode.enabled) attributeFilter.push('style', 'aria-valuenow');
    gridObserver.observe(active.grid, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter });
  }
  const mountObserver = new MutationObserver(() => {
    if (!active?.grid.isConnected || (active.waitingForList && active.grid.querySelector(mobileLists))) enter();
  });
  function findGrid() {
    if (location.pathname.replace(/\/$/, '') !== feedRoute) return;
    const page = document.querySelector(pageSelector);
    const mobile = !page && (document.querySelector('.tab-content[tab-identifier="FEsubscriptions"]:not([hidden], [hidden] *)') ||
      document.querySelector('ytm-browse:not([hidden], [hidden] *), main:not([hidden], [hidden] *)'));
    const grid = page?.querySelector('ytd-rich-grid-renderer > #contents') || page?.querySelector(grids) ||
      (mobile && (mobile.querySelector(mobileLists) || mobile.querySelector('ytm-rich-grid-renderer') ||
        (mobile.querySelector(cardTypes) && mobile)));
    if (!grid) return;
    if (active?.grid === grid) return;
    reset();
    grid.setAttribute('data-stopit-feed', '');
    if (mobile) mobile.setAttribute('data-stopit-mobile-subscriptions', '');
    active = { grid, mobile, waitingForList: mobile && !grid.matches(mobileLists),
      known: new Set(), order: [], dates: new Map(), lives: new Map() };
    observeGrid();
    schedule();
  }
  function reset() {
    mountObserver.disconnect();
    gridObserver.disconnect();
    clearTimeout(timer);
    timer = null;
    if (active) {
      if (active.mobile) active.mobile.removeAttribute('data-stopit-mobile-subscriptions');
      active.grid.removeAttribute('data-stopit-feed');
      StopItStrictMode.clear(active.grid);
      for (const live of active.lives.values()) live.tile.remove();
      for (const card of active.grid.querySelectorAll('[data-stopit-hidden]')) setHidden(card, false);
    }
    active = null;
  }
  function enter() {
    if (active && !active.grid.isConnected) reset();
    if (location.pathname.replace(/\/$/, '') !== feedRoute) {
      reset();
      return;
    }
    findGrid();
    mountObserver.observe(document, { childList: true, subtree: true });
  }
  document.addEventListener('stopit-account-changed', () => { reset(); enter(); });
  document.addEventListener('yt-navigate-finish', enter);
  document.addEventListener('stopit-strict-update', () => {
    if (active) {
      observeGrid();
      schedule();
    }
  });
  document.addEventListener('yt-page-data-updated', enter);
  window.navigation?.addEventListener('currententrychange', enter);
  window.addEventListener('popstate', enter);
  window.addEventListener('pageshow', enter);
  enter();
})();
