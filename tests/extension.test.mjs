import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const extension = fileURLToPath(new URL('../extension/', import.meta.url));
const youtube = 'https://www.youtube.com';
const subscriptions = youtube + '/feed/subscriptions';
const ids = {
  short: 'AAAAAAAAAAA',
  newest: 'BBBBBBBBBBB',
  live: 'CCCCCCCCCCC',
  replay: 'DDDDDDDDDDD',
  old: 'EEEEEEEEEEE',
  upcoming: 'FFFFFFFFFFF',
  unknown: 'GGGGGGGGGGG',
  older: 'HHHHHHHHHHH',
  longLive: 'IIIIIIIIIII'
};
const dates = {
  [ids.newest]: ['2025-01-05'],
  [ids.live]: ['2025-01-01', '2025-01-04'],
  [ids.replay]: ['2025-01-03', '2024-12-20', '2024-12-21'],
  [ids.old]: ['2025-01-02'],
  [ids.older]: ['2025-01-01'],
  [ids.longLive]: ['2024-11-01', '2024-12-30']
};
const grid = 'ytd-rich-grid-renderer > #contents';
const reads = new Map();
let context, profile;

function card(id, badge = '12:34') {
  return (
    '<ytd-rich-item-renderer data-id="' +
    id +
    '"><div class="ytLockupViewModelHost"><yt-touch-feedback-shape></yt-touch-feedback-shape>' +
    '<div class="ytLockupViewModelContentImage"><yt-thumbnail-badge-view-model><span class="ytBadgeShapeText">' +
    badge +
    '</span></yt-thumbnail-badge-view-model></div><h3><a href="/watch?v=' +
    id +
    '">' +
    id +
    '</a></h3></div></ytd-rich-item-renderer>'
  );
}
function feed() {
  return (
    '<style>ytd-rich-item-renderer,ytd-rich-section-renderer,ytd-guide-entry-renderer {display:block}</style>' +
    '<ytd-guide-renderer><ytd-guide-entry-renderer><a><span id="title">Shorts</span></a></ytd-guide-entry-renderer></ytd-guide-renderer>' +
    '<ytd-browse page-subtype="subscriptions"><ytd-rich-grid-renderer><div id="contents">' +
    '<ytd-rich-section-renderer id="header"><a href="/feed/channels">Mis canales</a></ytd-rich-section-renderer>' +
    '<ytd-rich-section-renderer id="picks"><h2>Más relevantes</h2>' +
    card(ids.old) +
    '</ytd-rich-section-renderer>' +
    '<ytd-rich-section-renderer id="shorts"><a href="/shorts/' +
    ids.short +
    '">Shorts</a></ytd-rich-section-renderer>' +
    card(ids.live, 'EN DIRECTO') +
    card(ids.longLive, 'LIVE') +
    card(ids.upcoming, 'Próximamente') +
    card(ids.newest) +
    card(ids.replay) +
    card(ids.old) +
    '<ytd-continuation-item-renderer></ytd-continuation-item-renderer>' +
    '</div></ytd-rich-grid-renderer></ytd-browse>'
  );
}
function watchPage(id) {
  if (id === ids.unknown) return '<p>Unavailable</p>';
  const isShort = id === ids.short;
  const route = isShort ? '/shorts/' + id : '/watch?v=' + id;
  const fields = ['datePublished', 'startDate', 'endDate'];
  const tags = (dates[id] || []).map(
    (date, i) => '<meta itemprop="' + fields[i] + '" content="' + date + 'T09:00:00Z">'
  );
  return (
    '<link rel="canonical" href="' +
    youtube +
    route +
    '">' +
    tags.join('') +
    '<h1>Player</h1><button>Play</button>' +
    '<ytd-watch-flexy><div id="secondary"><div id="secondary-inner">' +
    '<div id="playlist"><ytd-playlist-panel-renderer>Mi playlist</ytd-playlist-panel-renderer></div>' +
    '<div id="chat"><ytd-live-chat-frame>Chat en directo</ytd-live-chat-frame></div>' +
    '<div id="related"><ytd-watch-next-secondary-results-renderer>Sugeridos</ytd-watch-next-secondary-results-renderer></div>' +
    '</div></div></ytd-watch-flexy>'
  );
}

before(async () => {
  profile = await mkdtemp(path.join(tmpdir(), 'stopit-test-'));
  const unpacked = path.join(profile, 'extension');
  await cp(extension, unpacked, {
    recursive: true,
    filter: (source) => path.basename(source) !== '_metadata'
  });
  context = await chromium.launchPersistentContext(path.join(profile, 'browser'), {
    channel: 'chromium',
    executablePath: process.env.CHROME_FOR_TESTING || undefined,
    headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--load-extension=' + unpacked, '--disable-extensions-except=' + unpacked]
  });
  await context.route('https://www.youtube.com/**', async (route) => {
    const url = new URL(route.request().url());
    let body;
    if (url.pathname === '/feed/subscriptions') body = feed();
    else if (url.pathname === '/watch') {
      const id = url.searchParams.get('v');
      if (!route.request().isNavigationRequest()) reads.set(id, (reads.get(id) || 0) + 1);
      body = watchPage(id);
    } else body = '<h1>Player</h1><button>Play</button>';
    await route.fulfill({ contentType: 'text/html', body });
  });
  await context.route('https://i.ytimg.com/**', (route) => route.abort());
});
after(async () => {
  await context?.close();
  if (profile) await rm(profile, { recursive: true, force: true });
});

async function open(page, url, destination) {
  await page.goto(url, { waitUntil: 'commit' });
  try {
    await page.waitForURL(destination, { waitUntil: 'domcontentloaded', timeout: 10000 });
  } catch (error) {
    throw new Error(url + ' terminó en ' + page.url(), { cause: error });
  }
}
async function visibleOrder(page) {
  return page
    .locator(
      grid +
        ' > :is(ytd-rich-item-renderer, .stopit-live):visible h3 a, ' +
        grid +
        ' > .stopit-live:visible a'
    )
    .evaluateAll((links) => links.map((a) => new URL(a.href).searchParams.get('v')));
}

test('un enlace externo abre un video con el mismo feed de Inicio y conserva el reproductor, la playlist y el chat', async () => {
  const page = await context.newPage();
  const home = await context.newPage();
  try {
    // This is the first navigation in a fresh profile: there is no cached Home feed.
    const target = youtube + '/watch?v=' + ids.replay;
    await page.route('https://example.org/video', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<a href="' + target + '">Ver video</a>'
      })
    );
    await page.goto('https://example.org/video');
    await page.getByRole('link', { name: 'Ver video' }).click();
    const panel = page.locator('.stopit-watch-panel');
    const frame = panel.frameLocator('iframe');
    await panel.locator('iframe[data-stopit-state="ready"]').waitFor();
    assert.equal(page.url(), target);
    assert.equal(await page.locator('#related').isVisible(), false);
    for (const selector of ['#playlist', '#chat', 'h1']) assert.ok(await page.locator(selector).isVisible());
    assert.equal(await panel.count(), 1);
    const current = frame.locator('[data-stopit-playing] a[aria-current="true"]');
    assert.equal(await current.getAttribute('href'), '/watch?v=' + ids.replay);
    await open(home, youtube + '/', subscriptions);
    await home.waitForSelector('.stopit-live');
    assert.deepEqual(await visibleOrder(frame), await visibleOrder(home));
    // Model the native continuation: it adds the next batch only when the
    // user can scroll the sentinel into view inside the sidebar viewport.
    const sentinel = frame.locator('ytd-continuation-item-renderer');
    await sentinel.evaluate((node, html) => {
      document.querySelectorAll('ytd-rich-item-renderer').forEach((card) => (card.style.minHeight = '280px'));
      node.style.cssText = 'display:block;height:24px';
      const observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        node.insertAdjacentHTML('beforebegin', html);
      });
      observer.observe(node);
    }, card(ids.older));
    await sentinel.scrollIntoViewIfNeeded();
    await home
      .locator('ytd-continuation-item-renderer')
      .evaluate((node, html) => node.insertAdjacentHTML('beforebegin', html), card(ids.older));
    for (const scope of [frame, home]) {
      await scope.locator('[data-id="' + ids.older + '"] + .stopit-live').waitFor({ state: 'attached' });
    }
    assert.deepEqual(await visibleOrder(frame), await visibleOrder(home));
    await frame.getByRole('link', { name: ids.newest, exact: true }).click();
    await page.waitForURL(youtube + '/watch?v=' + ids.newest);
    await page.locator('.stopit-watch-panel iframe[data-stopit-state="ready"]').waitFor();
    assert.equal(
      await page.frameLocator('.stopit-watch-panel iframe').locator('[aria-current="true"]').textContent(),
      ids.newest
    );
  } finally {
    await page.close();
    await home.close();
  }
});

test('el panel centra la carga, ajusta la altura al modo de vista y contiene el hover de cada fila', async () => {
  const page = await context.newPage();
  const { promise: loading, resolve: showFeed } = Promise.withResolvers();
  await page.route('**/feed/subscriptions?stopit-panel=1', async (route) => {
    await loading;
    await route.fallback();
  });
  const panel = page.locator('.stopit-watch-panel');
  const iframe = panel.locator('iframe');
  const frame = panel.frameLocator('iframe');
  const atViewportBottom = () => page.waitForFunction(() =>
    Math.abs(document.querySelector('.stopit-watch-panel iframe').getBoundingClientRect().bottom - innerHeight) <= 1
  );
  try {
    const target = youtube + '/watch?v=' + ids.newest;
    await open(page, target, target);
    const status = panel.getByRole('status');
    await status.waitFor();
    await atViewportBottom();
    assert.equal(await panel.getByRole('heading').count(), 0);
    assert.equal(await panel.getByRole('link').count(), 0);
    assert.match(await status.textContent(), /Cargando suscripciones/);
    assert.equal(await status.evaluate((p) => getComputedStyle(p).placeItems), 'center');
    assert.deepEqual(await status.boundingBox(), await panel.boundingBox());
    assert.equal(await status.locator('span').evaluate((span) => getComputedStyle(span).clipPath), 'inset(50%)');
    const spinner = () => status.evaluate((p) => getComputedStyle(p, '::before').animationName);
    assert.equal(await spinner(), 'stopit-spin');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await spinner(), 'none');
    const loadingBounds = await panel.boundingBox();
    showFeed();
    await panel.locator('iframe[data-stopit-state="ready"]').waitFor();
    assert.deepEqual(await iframe.boundingBox(), loadingBounds);
    assert.equal(await status.count(), 0);
    await page.setViewportSize({ width: 1280, height: 1450 });
    await atViewportBottom();
    await page.locator('#chat').evaluate((chat) => { chat.style.height = '180px'; });
    await atViewportBottom();
    await page.evaluate(() => {
      document.body.style.minHeight = '200vh';
      window.scrollTo(0, 100);
    });
    await atViewportBottom();
    await page.locator('ytd-watch-flexy').evaluate((watch) => watch.setAttribute('theater', ''));
    assert.equal((await iframe.boundingBox()).height, 900);
    await page.locator('ytd-watch-flexy').evaluate((watch) => watch.removeAttribute('theater'));
    await atViewportBottom();

    const row = frame.locator('[data-id="' + ids.newest + '"]:visible');
    const next = frame.locator('.stopit-live').first();
    await row.hover();
    assert.equal(await row.locator('yt-touch-feedback-shape').isVisible(), false);
    const bounds = await row.boundingBox();
    assert.ok((await next.boundingBox()).y - (bounds.y + bounds.height) > 10);
    for (const dark of [false, true]) {
      await row.evaluate((_, dark) => document.documentElement.toggleAttribute('dark', dark), dark);
      const styles = await row.evaluate((el) => {
        const tile = getComputedStyle(el);
        const image = getComputedStyle(el.querySelector('.ytLockupViewModelContentImage'));
        return {
          overflow: tile.overflow,
          background: tile.backgroundColor,
          concentric: parseFloat(tile.borderRadius) - parseFloat(tile.padding) === parseFloat(image.borderRadius)
        };
      });
      assert.equal(styles.overflow, 'clip');
      assert.ok(styles.concentric);
      assert.equal(styles.background, dark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)');
    }
  } finally {
    showFeed();
    await page.close();
  }
});

test('el fondo del video se ve a través del panel en ambos temas', async () => {
  const page = await context.newPage();
  try {
    const target = youtube + '/watch?v=' + ids.newest;
    await open(page, target, target);
    const iframe = page.locator('.stopit-watch-panel iframe[data-stopit-state="ready"]');
    await iframe.waitFor();
    const frame = iframe.contentFrame();
    // Reproduce the page backgrounds painted by YouTube inside the subscriptions frame.
    await frame.locator('html').evaluate((html) => {
      const style = document.createElement('style');
      style.textContent = `
        html { background: white !important; color-scheme: light; }
        html[dark] { background: #0f0f0f !important; color-scheme: dark; }
        ytd-browse, ytd-rich-grid-renderer > #contents { background: #0f0f0f; }
      `;
      html.append(style);
    });
    const row = await frame.locator('[data-id="' + ids.newest + '"]:visible').boundingBox();
    // Sample the gap at identical coordinates with and without the panel.
    const gap = { x: Math.ceil(row.x) + 1, y: Math.ceil(row.y + row.height) + 2, width: 2, height: 4 };
    for (const scheme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: scheme === 'dark' ? 'light' : 'dark' });
      await page.evaluate((theme) => { document.documentElement.style.colorScheme = theme; }, scheme);
      await frame.locator('html').evaluate((html, theme) => html.toggleAttribute('dark', theme === 'dark'), scheme);
      for (const color of ['#453343', '#89acbc']) {
        await page.evaluate((color) => {
          document.documentElement.style.background = 'linear-gradient(to bottom, ' + color + ', #283543)';
        }, color);
        const backdrop = await page.screenshot({ clip: gap, style: '.stopit-watch-panel { visibility: hidden; }' });
        assert.ok(backdrop.equals(await page.screenshot({ clip: gap })), scheme + ' / ' + color);
      }
    }
  } finally {
    await page.close();
  }
});

test('Inicio filtra el feed y coloca cada directo por hora de inicio al cargar más videos', async () => {
  const page = await context.newPage();
  try {
    await open(page, youtube + '/?hl=es', subscriptions);
    await page.waitForSelector('.stopit-live', { state: 'attached' });
    assert.equal(await page.locator('#header').isVisible(), true);
    for (const selector of [
      '#picks',
      '#shorts',
      'ytd-guide-entry-renderer',
      '[data-id="' + ids.upcoming + '"]'
    ]) {
      assert.equal(await page.locator(selector).first().isVisible(), false, selector);
    }
    assert.deepEqual(await visibleOrder(page), [ids.newest, ids.live, ids.replay, ids.old, ids.longLive]);
    await page
      .locator('ytd-continuation-item-renderer')
      .evaluate((node, html) => node.insertAdjacentHTML('beforebegin', html), card(ids.older));
    await page.waitForFunction((id) => {
      const tile = document.querySelector('.stopit-live a[href*="' + id + '"]')?.closest('.stopit-live');
      return tile?.previousElementSibling?.dataset.id === 'HHHHHHHHHHH';
    }, ids.longLive);
    assert.deepEqual(await visibleOrder(page), [
      ids.newest,
      ids.live,
      ids.replay,
      ids.old,
      ids.older,
      ids.longLive
    ]);
  } finally {
    await page.close();
  }
});

test('bloquea Shorts directos, en watch y en el reproductor embebido abierto como página', async () => {
  const page = await context.newPage();
  const documents = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) documents.push(frame.url());
  });
  try {
    const before = reads.get(ids.short) || 0;
    for (const route of [
      '/shorts/' + ids.short,
      '/watch?v=' + ids.short,
      '/embed/' + ids.short,
      '/live/' + ids.short
    ]) {
      await open(page, youtube + route, subscriptions);
      assert.ok(!documents.includes(youtube + route));
    }
    assert.equal(reads.get(ids.short) - before, 1);
  } finally {
    await page.close();
  }
});

test('conserva parámetros, marca de tiempo e historial en un cambio interno de video', async () => {
  const page = await context.newPage();
  const regular = youtube + '/watch?list=PLtest&t=2&v=' + ids.newest + '#t=2';
  try {
    await open(page, regular, regular);
    await page.getByRole('button', { name: 'Play' }).click();
    await page.evaluate((id) => history.pushState(null, '', '/watch?v=' + id), ids.short);
    await page.waitForURL(subscriptions, { timeout: 10000 });
    await page.goBack();
    await page.waitForURL(regular, { timeout: 10000 });
    await page.evaluate(() => {
      const a = document.createElement('a');
      a.href = '/';
      a.textContent = 'Inicio de YouTube';
      document.body.append(a);
    });
    await page.getByRole('link', { name: 'Inicio de YouTube' }).click();
    await page.waitForURL(subscriptions);
  } finally {
    await page.close();
  }
});

test('ofrece reintentar si YouTube no identifica el contenido', async () => {
  const page = await context.newPage();
  try {
    await page.goto(youtube + '/watch?v=' + ids.unknown, { waitUntil: 'commit' });
    await page.getByRole('button', { name: 'Reintentar' }).waitFor({ timeout: 10000 });
    assert.equal(new URL(page.url()).protocol, 'chrome-extension:');
    await page.getByRole('link', { name: 'Ir a Suscripciones' }).click();
    await page.waitForURL(subscriptions);
  } finally {
    await page.close();
  }
});

test('si falla el feed se puede reintentar sin perder el video ni mostrar recomendaciones', async () => {
  const page = await context.newPage();
  let working = false;
  await page.route('**/feed/subscriptions?stopit-panel=1', (route) =>
    route.fulfill({
      status: working ? 200 : 503,
      contentType: 'text/html',
      body: working ? feed() : '<p>Temporalmente no disponible</p>'
    })
  );
  try {
    const target = youtube + '/watch?v=' + ids.newest;
    await open(page, target, target);
    const panel = page.locator('.stopit-watch-panel');
    const retry = panel.getByRole('button', { name: 'Reintentar' });
    await retry.waitFor({ timeout: 17000 });
    assert.equal(await page.locator('#related').isVisible(), false);
    assert.equal(
      await panel.getByRole('link', { name: 'Suscripciones' }).getAttribute('href'),
      subscriptions
    );
    working = true;
    await retry.click();
    await panel.locator('iframe[data-stopit-state="ready"]').waitFor();
    assert.equal(page.url(), target);
    assert.equal(await page.locator('.stopit-watch-panel iframe').count(), 1);
    // YouTube replaces parts of the secondary column on layout changes.
    await page.locator('#secondary-inner').evaluate((node) => {
      const fresh = document.createElement('div');
      fresh.id = node.id;
      fresh.append(
        node.querySelector('#playlist'),
        node.querySelector('#chat'),
        node.querySelector('#related')
      );
      node.replaceWith(fresh);
    });
    await page.locator('#secondary-inner .stopit-watch-panel iframe[data-stopit-state="ready"]').waitFor();
    assert.equal(await page.locator('.stopit-watch-panel').count(), 1);
  } finally {
    await page.close();
  }
});

test('un feed vacío o sin sesión muestra el acceso a Suscripciones y conserva los controles compartidos', async () => {
  const page = await context.newPage();
  let signedIn = false;
  await page.route('**/feed/subscriptions?stopit-panel=1', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body:
        '<ytd-browse page-subtype="subscriptions"><ytd-background-promo-renderer>' +
        (signedIn ? 'Sin suscripciones' : '<a href="/signin">Iniciar sesión</a>') +
        '</ytd-background-promo-renderer></ytd-browse>'
    })
  );
  try {
    for (const state of ['signedout', 'empty']) {
      signedIn = state === 'empty';
      const target = youtube + '/watch?v=' + (signedIn ? ids.newest : ids.old);
      await open(page, target, target);
      await page
        .locator('.stopit-watch-panel iframe[data-stopit-state="' + state + '"]')
        .waitFor({ state: 'attached' });
      assert.equal(await page.locator('#related').isVisible(), false);
      assert.ok(await page.locator('.stopit-watch-panel p').isVisible());
    }
    await page.locator('ytd-watch-next-secondary-results-renderer').evaluate((node) => {
      node.append(
        document.querySelector('#playlist'),
        document.querySelector('#chat'),
        document.createElement('ytd-compact-video-renderer')
      );
      node.lastElementChild.textContent = 'Recomendado';
    });
    assert.ok(await page.locator('#playlist').isVisible());
    assert.ok(await page.locator('#chat').isVisible());
    assert.equal(await page.locator('ytd-compact-video-renderer').isVisible(), false);
  } finally {
    await page.close();
  }
});

test('oculta cada sección de Shorts de la búsqueda, incluidas las que se cargan después', async () => {
  const page = await context.newPage();
  const shelf = `<grid-shelf-view-model><h2>Shorts</h2>
    <ytm-shorts-lockup-view-model-v2><a href="/shorts/AAAAAAAAAAA">Doom en el Nokia</a></ytm-shorts-lockup-view-model-v2>
    <button>Mostrar más</button></grid-shelf-view-model>`;
  try {
    await page.route('**/results?*', (route) => route.fulfill({ contentType: 'text/html', body: `
      <ytd-search><ytd-item-section-renderer><div id="contents">
        ${shelf}
        <ytd-video-renderer><a href="/watch?v=BBBBBBBBBBB">Doom en PC</a></ytd-video-renderer>
        <grid-shelf-view-model><h2>Videos relacionados</h2>
          <a href="/watch?v=EEEEEEEEEEE">Historia de los Shorts</a>
          <p>Ejemplo: <a href="/shorts/AAAAAAAAAAA">ver clip</a></p>
        </grid-shelf-view-model>
      </div></ytd-item-section-renderer></ytd-search>` }));
    await page.goto(youtube + '/results?search_query=doom+on+n+95');
    const shorts = page.locator('grid-shelf-view-model:has(ytm-shorts-lockup-view-model-v2)');
    assert.equal(await shorts.count(), 1);
    assert.equal(await shorts.first().boundingBox(), null);
    await page.locator('ytd-search #contents').evaluate((el, html) => el.insertAdjacentHTML('beforeend', html), shelf);
    assert.equal(await shorts.count(), 2);
    assert.equal(await shorts.last().boundingBox(), null);
    assert.equal(await page.getByRole('button', { name: 'Mostrar más' }).count(), 0);
    for (const name of ['Doom en PC', 'Historia de los Shorts']) assert.ok(await page.getByRole('link', { name }).isVisible());
  } finally {
    await page.close();
  }
});

test('oculta los controles Shorts de biblioteca, búsqueda y canales cuando YouTube cambia sus etiquetas', async () => {
  const page = await context.newPage();
  try {
    await page.goto(youtube + '/feed/history');
    for (const route of ['/feed/history', '/feed/playlists', '/playlist?list=WL', '/playlist?list=LL', '/results', '/@canal/videos']) {
      await page.evaluate((route) => {
        history.pushState(null, '', route);
        document.body.innerHTML = `
          <div class="ytChipBarViewModelChipWrapper" id="chip"><chip-view-model><chip-shape>
            <button role="tab"><span class="ytChipShapeText">Shorts</span></button>
          </chip-shape></chip-view-model></div>
          <yt-chip-cloud-chip-renderer id="search"><button role="tab">Shorts</button></yt-chip-cloud-chip-renderer>
          <yt-tab-shape id="channel" role="tab" tab-title="Shorts">Shorts</yt-tab-shape>
          <ytd-search-filter-renderer id="filter"><a href="/results"><yt-formatted-string>Shorts</yt-formatted-string></a></ytd-search-filter-renderer>
          <button id="label" aria-label="Shorts">Filtrar</button><button id="all">Todos</button>
          <a href="/watch?v=BBBBBBBBBBB" id="title">Shorts</a><button id="similar">Canales de Shorts</button>`;
      }, route);
      for (const id of ['chip', 'search', 'channel', 'filter', 'label']) {
        assert.equal(await page.locator('#' + id).isVisible(), false, route + ' #' + id);
      }
      for (const id of ['all', 'title', 'similar']) assert.ok(await page.locator('#' + id).isVisible());
    }
    await page.locator('.ytChipShapeText').evaluate((el) => { el.firstChild.data = 'Videos'; });
    await page.locator('#chip button').waitFor();
    await page.locator('#label').evaluate((el) => el.setAttribute('aria-label', 'Videos'));
    await page.locator('#label').waitFor();
  } finally {
    await page.close();
  }
});

test('la campana y el panel respetan el ajuste guardado en todas las pestañas', async () => {
  const pages = await Promise.all([context.newPage(), context.newPage()]);
  const settings = await context.newPage();
  const notificationMenu = '[menu-style="multi-page-menu-style-type-notifications"]';
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const settingsUrl = await worker.evaluate(() => chrome.runtime.getURL(chrome.runtime.getManifest().action.default_popup));
  try {
    for (const page of pages) {
      await page.route('**/feed/history', (route) => route.fulfill({ contentType: 'text/html', body: `
        <ytd-masthead><button id="profile">Perfil</button>
          <ytd-notification-topbar-button-renderer><button id="bell">Notificaciones (9+)</button></ytd-notification-topbar-button-renderer>
        </ytd-masthead>
        <ytd-popup-container>
          <tp-yt-iron-dropdown id="inbox"><ytd-multi-page-menu-renderer menu-style="multi-page-menu-style-type-notifications">Notificaciones</ytd-multi-page-menu-renderer></tp-yt-iron-dropdown>
          <tp-yt-iron-dropdown id="account">
            <ytd-multi-page-menu-renderer hidden><ytd-notification-section-renderer></ytd-notification-section-renderer></ytd-multi-page-menu-renderer>
            <ytd-multi-page-menu-renderer>Mi cuenta</ytd-multi-page-menu-renderer>
          </tp-yt-iron-dropdown>
        </ytd-popup-container>
        <button id="channel-bell">Notificaciones del canal</button>
        <script>document.querySelector('#bell').onclick = () => { const inbox = document.querySelector('#inbox'); inbox.hidden = !inbox.hidden; };</script>` }));
      await page.goto(youtube + '/feed/history');
      assert.equal(await page.locator('#bell').isVisible(), false);
      assert.equal(await page.locator('#inbox').isVisible(), false);
    }
    await settings.goto(settingsUrl);
    const toggle = settings.getByRole('switch', { name: 'Mostrar notificaciones' });
    assert.equal(await toggle.isChecked(), false);
    await toggle.check();
    for (const page of pages) {
      await page.locator('#bell').waitFor();
      await page.locator(notificationMenu).waitFor();
    }
    await pages[1].reload();
    await pages[1].locator('#bell').waitFor();
    await settings.reload();
    await settings.locator('input:checked').waitFor();
    await toggle.uncheck();
    for (const page of pages) {
      await page.locator('#inbox').waitFor({ state: 'hidden' });
      assert.equal(await page.locator('#bell').isVisible(), false);
      for (const id of ['profile', 'account', 'channel-bell']) assert.ok(await page.locator('#' + id).isVisible());
    }
    await toggle.check();
    await pages[0].locator('#bell').waitFor();
    assert.equal(await pages[0].locator(notificationMenu).isVisible(), false);
    await pages[0].locator('#bell').click();
    await pages[0].locator(notificationMenu).waitFor();
  } finally {
    await worker.evaluate(() => chrome.storage.local.remove('showNotifications'));
    await Promise.all([...pages, settings].map((page) => page.close()));
  }
});
