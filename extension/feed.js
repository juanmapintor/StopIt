(() => {
  const feedRoute = '/feed/subscriptions';
  const pageSelector = 'ytd-browse[page-subtype="subscriptions"]:not([hidden])';
  const grids =
    'ytd-rich-grid-renderer > #contents, ytd-grid-renderer > #items, ytd-section-list-renderer > #contents';
  const cardTypes = 'ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-video-renderer';
  const shelf =
    'ytd-rich-section-renderer, ytd-rich-shelf-renderer, ytd-shelf-renderer, grid-shelf-view-model, ytd-reel-shelf-renderer';
  const videoLink = 'a:is([href^="/watch?"], [href^="/live/"], [href^="https://www.youtube.com/watch?"])';
  const badgeLabels =
    'yt-thumbnail-badge-view-model :is(.ytBadgeShapeText, .yt-badge-shape__text), ytd-thumbnail-overlay-time-status-renderer #text';
  let active = null;
  let timer;
  let revision = 0;
  let reading = 0;
  const waiting = [];

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

  async function readMetadata(id) {
    if (reading >= 3) await new Promise((resolve) => waiting.push(resolve));
    else reading++;
    try {
      return await StopItMetadata.read(id).catch(() => StopItMetadata.read(id, 'include'));
    } finally {
      if (waiting.length) waiting.shift()();
      else reading--;
    }
  }

  function metadata(state, id) {
    const cached = state.dates.get(id);
    if (cached && cached.until > Date.now()) return cached.promise;
    const entry = { until: Infinity };
    entry.promise = readMetadata(id)
      .then((data) => {
        if (data.start && !data.end) entry.until = Date.now() + 60000;
        return data;
      })
      .catch(() => {
        entry.until = Date.now() + 30000;
        return null;
      });
    state.dates.set(id, entry);
    return entry.promise;
  }

  function cardType(card) {
    if (card.querySelector('a[href^="/shorts/"], [overlay-style="SHORTS"]')) return 'skip';
    const labels = Array.from(card.querySelectorAll(badgeLabels), (n) => n.textContent.trim()).filter(
      Boolean
    );
    if (
      card.querySelector('[overlay-style="UPCOMING"]') ||
      labels.some((s) => /^(upcoming|premiere|próximamente|programado|estreno)$/i.test(s))
    )
      return 'skip';
    if (
      card.querySelector(
        '[overlay-style="LIVE"], .badge-style-type-live-now, .yt-badge-shape--thumbnail-live, .ytBadgeShapeThumbnailLive'
      ) ||
      labels.some((s) => /^(live|live now|en vivo|en directo|directo)$/i.test(s))
    )
      return 'live';
    // A non-duration thumbnail badge may be a localized live or scheduled badge.
    return labels.length && !labels.some((s) => /\d\s*:\s*\d/.test(s)) ? 'inspect' : 'ordinary';
  }

  function liveTile(card, id) {
    const tile = document.createElement('div');
    tile.className = 'stopit-live';
    const link = document.createElement('a');
    link.href = '/watch?v=' + id;
    const preview = document.createElement('span');
    preview.className = 'preview';
    const image = document.createElement('img');
    image.src = 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg';
    image.alt = '';
    image.loading = 'lazy';
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = 'En vivo';
    const title = document.createElement('strong');
    title.textContent =
      card.querySelector('h3 a, #video-title, #video-title-link')?.textContent.trim() ||
      card.querySelector(videoLink)?.getAttribute('aria-label') ||
      'Ver directo';
    const channel = document.createElement('span');
    channel.className = 'channel';
    channel.textContent = card.querySelector('a[href^="/@"], ytd-channel-name a')?.textContent.trim() || '';
    preview.append(image, badge);
    link.append(preview, title, channel);
    tile.append(link);
    return tile;
  }

  // Ordinary uploads already arrive newest first. Only probe the ordinary
  // videos needed to find the insertion point, rather than fetch every watch page.
  async function insertionIndex(state, started) {
    let low = 0,
      high = state.order.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      const details = await metadata(state, state.order[middle]);
      if (!details?.published) return null;
      if (details.published >= started) low = middle + 1;
      else high = middle;
    }
    return low;
  }

  function setHidden(card, hidden) {
    card.toggleAttribute('data-stopit-hidden', hidden);
  }

  async function applyFeed(state, version) {
    const cards = [...state.grid.querySelectorAll(cardTypes)].filter((card) => !card.closest(shelf));
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
    const inspected = await Promise.all(
      cards.map(async (card) => {
        const link = card.querySelector(videoLink);
        if (!link) return null;
        const url = new URL(link.href);
        const id = url.searchParams.get('v') || url.pathname.split('/')[2];
        if (!StopItMetadata.validId(id)) return null;
        const type = cardType(card);
        if (type === 'skip') {
          setHidden(card, true);
          return { card, id, hidden: true };
        }
        if (liveShelfCards.has(card) && type === 'ordinary') return null;
        if (type === 'ordinary') return { card, id };
        // Hide a possibly scheduled or pinned item while reading its exact start.
        setHidden(card, true);
        const data = await metadata(state, id);
        if (!data || data.kind === 'short' || data.upcoming || data.start > Date.now())
          return { card, id, hidden: true };
        const started = !data.end && (data.liveNow || type === 'live') ? data.start : null;
        if (liveShelfCards.has(card) && !started) return null;
        return { card, id, started };
      })
    );
    if (state !== active || version !== revision) return;

    for (const item of inspected) {
      if (!item) continue;
      const { card, id, started } = item;
      if (started && !state.lives.has(id)) state.lives.set(id, { tile: liveTile(card, id), started });
      if (!started && state.lives.has(id)) {
        state.lives.get(id).tile.remove();
        state.lives.delete(id);
      }
      setHidden(card, Boolean(item.hidden || started || mounted.has(id)));
      if (!item.hidden && !started && !mounted.has(id)) mounted.set(id, card);
    }
    // A recycled slot may get its live/upcoming badge after its watch link.
    for (const item of inspected) {
      if (item && !mounted.has(item.id)) state.known.delete(item.id);
    }
    if (state.order.length !== state.known.size) state.order = state.order.filter((id) => state.known.has(id));
    mergeWindow(state, [...mounted.keys()]);

    const placements = new Map();
    const lives = [...state.lives.entries()].sort((a, b) => b[1].started - a[1].started);
    for (const [id, live] of lives) {
      const latest = await metadata(state, id);
      if (state !== active || version !== revision) return;
      if (!latest || latest.end || latest.kind !== 'video') {
        live.tile.remove();
        if (latest?.end) state.lives.delete(id);
        continue;
      }
      const index = await insertionIndex(state, live.started);
      if (state !== active || version !== revision) return;
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
    globalThis.StopItPanelFeed?.updated(state.grid);
  }

  function schedule() {
    if (!active || timer) return;
    timer = setTimeout(() => {
      timer = null;
      if (active) applyFeed(active, ++revision).catch(console.error);
    }, 40);
  }

  const gridObserver = new MutationObserver((records) => {
    if (
      records.some(
        (record) =>
          record.type !== 'childList' ||
          [...record.addedNodes, ...record.removedNodes].some(
            (node) => !node.classList?.contains('stopit-live')
          )
      )
    )
      schedule();
  });
  const mountObserver = new MutationObserver(findGrid);
  function findGrid() {
    const page = document.querySelector(pageSelector);
    const grid = page?.querySelector('ytd-rich-grid-renderer > #contents') || page?.querySelector(grids);
    if (!grid || location.pathname.replace(/\/$/, '') !== feedRoute) return;
    if (active?.grid === grid) return;
    reset();
    active = { grid, known: new Set(), order: [], dates: new Map(), lives: new Map() };
    gridObserver.observe(grid, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['href', 'overlay-style', 'aria-label']
    });
    schedule();
  }
  function reset() {
    mountObserver.disconnect();
    gridObserver.disconnect();
    clearTimeout(timer);
    timer = null;
    if (active) {
      for (const live of active.lives.values()) live.tile.remove();
      for (const card of active.grid.querySelectorAll('[data-stopit-hidden]')) setHidden(card, false);
    }
    active = null;
    revision++;
  }
  function enter() {
    if (active && !active.grid.isConnected) reset();
    if (location.pathname.replace(/\/$/, '') !== feedRoute) {
      reset();
      return;
    }
    findGrid();
    if (!active) mountObserver.observe(document, { childList: true, subtree: true });
  }
  document.addEventListener('yt-navigate-finish', enter);
  document.addEventListener('yt-page-data-updated', enter);
  navigation.addEventListener('currententrychange', enter);
  window.addEventListener('pageshow', enter);
  setInterval(() => {
    if (active?.lives.size && !document.hidden) schedule();
  }, 60000);
  enter();
})();
