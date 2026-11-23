import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
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
let context, profile, labels;

function card(id, badge = '12:34', time) {
  const isLive = ['LIVE', 'EN DIRECTO'].includes(badge);
  const date = dates[id]?.[isLive ? 1 : 0];
  const metadata = time ?? (date ? '<time itemprop="' + (isLive ? 'startDate' : 'datePublished') +
    '" datetime="' + date + 'T09:00:00Z"></time>' : '');
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
    '</a></h3>' + metadata + '</div></ytd-rich-item-renderer>'
  );
}
function feed() {
  return (
    '<meta charset="utf-8"><style>ytd-rich-item-renderer,ytd-rich-section-renderer,ytd-guide-entry-renderer {display:block}</style>' +
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
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const uiLanguage = await worker.evaluate(() => chrome.i18n.getUILanguage());
  const language = uiLanguage.split('-')[0] === 'es' ? 'es' : 'en';
  const catalog = JSON.parse(await readFile(path.join(extension, '_locales', language, 'messages.json'), 'utf8'));
  labels = Object.fromEntries(Object.entries(catalog).map(([key, entry]) => [key, entry.message]));
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
    const playingLabel = await frame.locator('[data-stopit-playing]').evaluate(el => getComputedStyle(el, '::after').content);
    assert.equal(playingLabel, JSON.stringify(labels.nowPlaying));
    assert.equal(await panel.getAttribute('aria-label'), labels.subscriptions);
    assert.equal(await panel.locator('iframe').getAttribute('title'), labels.subscriptionVideos);
    await open(home, youtube + '/', subscriptions);
    await home.waitForSelector('.stopit-live');
    assert.equal(await home.locator('.stopit-live .badge').first().textContent(), labels.liveBadge);
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

test('Chrome elige el catálogo de los ajustes y usa inglés como idioma predeterminado', async () => {
  const catalogs = await Promise.all(['en', 'es'].map(async lang =>
    JSON.parse(await readFile(path.join(extension, '_locales', lang, 'messages.json'), 'utf8'))
  ));
  assert.deepEqual(Object.keys(catalogs[0]).sort(), Object.keys(catalogs[1]).sort());
  const worker = await strictWorker();
  const manifest = await worker.evaluate(() => chrome.runtime.getManifest());
  assert.equal(manifest.default_locale, 'en');
  assert.equal(manifest.name, labels.extensionName);
  assert.equal(manifest.description, labels.extensionDescription);
  assert.equal(await worker.evaluate(() => chrome.action.getTitle({})), labels.settingsTitle);
  const page = await context.newPage();
  try {
    await page.goto(await worker.evaluate(() => chrome.runtime.getURL('settings.html')));
    assert.equal(await page.title(), labels.settingsTitle);
    assert.equal(await page.locator('html').getAttribute('lang'), labels.languageCode);
    assert.equal(await page.getByRole('heading').textContent(), labels.settingsTitle);
    for (const label of ['showNotifications', 'strictMode']) {
      assert.ok(await page.getByRole('switch', { name: labels[label], exact: true }).isVisible());
    }
  } finally {
    await page.close();
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
    assert.equal(await status.textContent(), labels.panelLoading);
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
    await atViewportBottom();
    assert.ok((await iframe.boundingBox()).height > 900);
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

test('el panel acompaña los comentarios y llena el espacio visible también en modo cine', async () => {
  const page = await context.newPage();
  const target = youtube + '/watch?v=' + ids.newest;
  const layout = `<style>
    * {box-sizing:border-box} body {margin:0;padding-top:56px}
    #masthead-container {position:fixed;inset:0 0 auto;height:56px;background:#111;z-index:10}
    ytd-watch-flexy {display:block} #columns {display:flex;align-items:flex-start;gap:16px;padding:16px}
    #primary {flex:1;min-width:0;height:4400px} #secondary {width:32%}
    #cinema {display:none} [theater] #cinema {display:block;height:75vh}
    [theater] #columns {transform:translateZ(0);border:2px solid transparent}
    #playlist {height:40px} #chat {height:60px}
    @media (max-width:700px) {#columns {display:block} #secondary {width:100%}}
  </style><div id="masthead-container"></div>`;
  const body = '<!doctype html>' + watchPage(ids.newest)
    .replace('<h1>Player</h1><button>Play</button>', layout)
    .replace('<ytd-watch-flexy>', '<ytd-watch-flexy><div id="cinema"></div><div id="columns"><main id="primary">Comentarios</main>')
    .replace('</ytd-watch-flexy>', '</div></ytd-watch-flexy>');
  let feedLoads = 0;
  await page.route(target, route => route.fulfill({ contentType: 'text/html', body }));
  await page.route('**/feed/subscriptions?stopit-panel=1', route => {
    feedLoads++;
    return route.fulfill({ contentType: 'text/html', body: feed() });
  });
  const checkBounds = pinned => page.waitForFunction(pinned => {
    const iframe = document.querySelector('.stopit-watch-panel iframe').getBoundingClientRect();
    const column = document.querySelector('#secondary').getBoundingClientRect();
    const bar = document.querySelector('#masthead-container').getBoundingClientRect();
    const top = pinned ? bar.bottom : document.querySelector('#chat').getBoundingClientRect().bottom;
    return Math.abs(iframe.top - top) <= 1 && Math.abs(iframe.bottom - innerHeight) <= 1 &&
      Math.abs(iframe.left - column.left) <= 1 && Math.abs(iframe.width - column.width) <= 1;
  }, pinned, { timeout: 3000 });
  try {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await open(page, target, target);
    await page.locator('.stopit-watch-panel iframe[data-stopit-state="ready"]').waitFor();
    for (const theater of [false, true]) {
      await page.evaluate(theater => {
        window.scrollTo(0, 0);
        document.querySelector('ytd-watch-flexy').toggleAttribute('theater', theater);
      }, theater);
      await checkBounds(false);
      for (const y of [1300, 2750]) {
        await page.evaluate(y => window.scrollTo(0, y), y);
        await checkBounds(true);
      }
    }
    await page.setViewportSize({ width: 1100, height: 1450 });
    await page.locator('#masthead-container').evaluate(el => { el.style.height = '72px'; });
    await checkBounds(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await checkBounds(false);
    assert.equal(feedLoads, 1);
    await page.setViewportSize({ width: 640, height: 760 });
    await page.evaluate(() => window.scrollTo(0, 1600));
    await page.waitForFunction(() => document.querySelector('.stopit-watch-panel').getBoundingClientRect().top > innerHeight);
  } finally {
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
  const before = new Map(reads);
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
    assert.deepEqual(reads, before);
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
    await page.getByRole('button', { name: labels.retry }).waitFor({ timeout: 10000 });
    assert.equal(new URL(page.url()).protocol, 'chrome-extension:');
    assert.equal(await page.title(), labels.checkTitle);
    assert.equal(await page.locator('html').getAttribute('lang'), labels.languageCode);
    assert.equal(await page.getByRole('status').textContent(), labels.checkFailed);
    assert.equal(await page.locator('#detail').textContent(), labels.checkFailedDetail);
    await page.getByRole('link', { name: labels.goToSubscriptions }).click();
    await page.waitForURL(subscriptions);
  } finally {
    await page.close();
  }
});

test('una apertura explícita respeta el 429 y espera a que el usuario reintente', async () => {
  const page = await context.newPage();
  let requests = 0;
  const url = youtube + '/watch?v=LLLLLLLLLLL';
  const limited = route => {
    requests++;
    return route.fulfill({ status: 429 });
  };
  await context.route(url, limited);
  try {
    await page.goto(url, { waitUntil: 'commit' });
    await page.getByRole('button', { name: labels.retry }).waitFor();
    assert.equal(requests, 1);
  } finally {
    await page.close();
    await context.unroute(url, limited);
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
    const retry = panel.getByRole('button', { name: labels.retry });
    await retry.waitFor({ timeout: 17000 });
    assert.equal(await page.locator('#related').isVisible(), false);
    assert.equal(
      await panel.getByRole('link', { name: labels.openSubscriptions }).getAttribute('href'),
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
    const toggle = settings.getByRole('switch', { name: labels.showNotifications });
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

const strictAccount = '123||456';
const sinceJan2 = Date.parse('2025-01-02T12:00:00Z');

function signedInPage(html, account = strictAccount) {
  return '<script>window.ytcfg = {set() {}}; ytcfg.set(' +
    JSON.stringify({ LOGGED_IN: true, DATASYNC_ID: account }) + ');</script>' + html;
}

async function strictWorker() {
  return context.serviceWorkers()[0] || context.waitForEvent('serviceworker');
}

async function resetStrict(worker) {
  await worker.evaluate(async () => {
    if (globalThis.realNow) Date.now = globalThis.realNow;
    const data = await chrome.storage.local.get(null);
    await chrome.storage.local.remove(Object.keys(data).filter((key) => key.startsWith('strict')));
  });
}

async function setWorkerTime(worker, time) {
  await worker.evaluate((ms) => {
    globalThis.realNow ??= Date.now;
    Date.now = () => ms;
  }, time);
}

test('Modo estricto agrupa las dos vistas por fecha y progreso y se puede desactivar en caliente', async () => {
  const worker = await strictWorker();
  const home = await context.newPage();
  const settings = await context.newPage();
  let account = strictAccount;
  const withProgress = feed().replace(card(ids.replay), card(ids.replay).replace('<h3>', '<div class="ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment" style="width:12%"></div><h3>'));
  await home.route('**/feed/subscriptions*', (route) => route.fulfill({ contentType: 'text/html', body: signedInPage(withProgress, account) }));
  const visitKey = 'strictVisit:' + strictAccount;
  try {
    await home.goto(subscriptions);
    await home.locator('.stopit-live').first().waitFor();
    await settings.goto(await worker.evaluate(() => chrome.runtime.getURL('settings.html')));
    const toggle = settings.getByRole('switch', { name: labels.strictMode });
    assert.equal(await toggle.isChecked(), false);
    assert.equal(await home.locator('[data-stopit-heading]').count(), 0);
    await toggle.check();
    await home.bringToFront();
    const fresh = home.getByRole('button', { name: labels.sectionNew });
    await fresh.waitFor();
    assert.ok(await fresh.isDisabled());
    const older = home.getByRole('button', { name: labels.sectionOlder });
    const seen = home.getByRole('button', { name: labels.sectionWatched });
    assert.equal(await older.getAttribute('aria-expanded'), 'true');
    assert.equal(await seen.getAttribute('aria-expanded'), 'false');
    await older.click();
    assert.deepEqual(await visibleOrder(home), [ids.newest, ids.live, ids.old, ids.longLive]);
    await seen.click();
    assert.equal(await older.getAttribute('aria-expanded'), 'false');
    assert.deepEqual(await visibleOrder(home), [ids.replay]);
    assert.equal(await home.locator('[data-stopit-group="seen"] h3 a').textContent(), ids.replay);
    await toggle.uncheck();
    await home.locator('[data-stopit-heading]').first().waitFor({ state: 'detached' });
    assert.deepEqual(await visibleOrder(home), [ids.newest, ids.live, ids.replay, ids.old, ids.longLive]);

    await worker.evaluate((since) => chrome.storage.local.set({ strictSince: since }), sinceJan2);
    await home.bringToFront();
    const newLinks = home.locator('[data-stopit-group="new"]:visible a');
    await newLinks.first().waitFor();
    assert.deepEqual(await newLinks.evaluateAll(as => as.map(a => new URL(a.href).searchParams.get('v'))), [ids.newest, ids.live]);
    assert.equal(await home.locator('[data-stopit-group="older"]:visible').count(), 0);
    assert.equal(await home.locator('ytd-continuation-item-renderer').isVisible(), false);
    await fresh.click();
    const sentinel = home.locator('ytd-continuation-item-renderer');
    assert.equal(await older.getAttribute('aria-expanded'), 'true');
    await sentinel.evaluate(el => { el.style.cssText = 'display:block;height:20px'; });
    assert.ok(await sentinel.isVisible());
    await sentinel.evaluate((el, html) => el.insertAdjacentHTML('beforebegin', html), card(ids.older));
    await home.locator('[data-id="' + ids.older + '"][data-stopit-group="older"]').waitFor();
    const visit = await worker.evaluate(async key => (await chrome.storage.local.get(key))[key], visitKey);
    assert.equal(visit.cutoff, sinceJan2);

    await fresh.click();
    await home.getByRole('link', { name: ids.newest, exact: true }).click();
    const panel = home.frameLocator('.stopit-watch-panel iframe');
    await panel.locator('[data-stopit-heading="new"]').waitFor();
    assert.equal(await panel.getByRole('button', { name: labels.sectionOlder }).getAttribute('aria-expanded'), 'false');
    assert.deepEqual(new Set(await panel.locator('[data-stopit-group="new"] a').evaluateAll(as => as.map(a => new URL(a.href).searchParams.get('v')))), new Set([ids.newest, ids.live]));
    assert.deepEqual(await worker.evaluate(async key => (await chrome.storage.local.get(key))[key], visitKey), visit);

    account = 'other||account';
    await home.goto(subscriptions);
    await home.locator('[data-stopit-strict-grid]').waitFor();
    const seenB = await worker.evaluate(() => chrome.storage.local.get('strictSeen:other||account:DDDDDDDDDDD'));
    assert.ok(seenB['strictSeen:other||account:DDDDDDDDDDD']); // Also has native progress in this account.
    await home.locator('[data-id="' + ids.newest + '"][data-stopit-group="new"]').waitFor();
  } finally {
    await Promise.all([home.close(), settings.close()]);
    await resetStrict(worker);
  }
});

test('las visitas tienen cinco minutos de margen y Atrás recupera su corte incluso después de otra visita', async () => {
  const worker = await strictWorker();
  const home = await context.newPage();
  let healthy = true;
  await home.route('**/feed/subscriptions*', route => route.fulfill({ contentType: 'text/html',
    body: signedInPage(healthy ? feed() : '<ytd-browse page-subtype="subscriptions">Error</ytd-browse>') }));
  const key = 'strictVisit:' + strictAccount;
  const visited = () => worker.evaluate(async key => (await chrome.storage.local.get(key))[key], key);
  const start = Date.parse('2025-01-04T12:00:00Z');
  try {
    await worker.evaluate(since => chrome.storage.local.set({ strictSince: since }), sinceJan2);
    await setWorkerTime(worker, start);
    await home.goto(subscriptions);
    await home.locator('[data-stopit-strict-grid]').waitFor();
    for (const minutes of [2, 5]) {
      await setWorkerTime(worker, start + minutes * 60_000);
      await home.reload();
      await home.locator('[data-stopit-strict-grid]').waitFor();
      assert.equal((await visited()).cutoff, sinceJan2);
      assert.equal((await visited()).lastVisit, start + minutes * 60_000);
    }
    await setWorkerTime(worker, start + 45 * 60_000);
    await home.getByRole('link', { name: ids.newest, exact: true }).click();
    const panel = home.frameLocator('.stopit-watch-panel iframe');
    await panel.locator('[data-stopit-group="new"][data-id="' + ids.replay + '"]').waitFor();
    assert.equal((await visited()).lastVisit, start + 5 * 60_000);
    const other = await context.newPage();
    try {
      await other.route('**/feed/subscriptions*', route => route.fulfill({ contentType: 'text/html', body: signedInPage(feed()) }));
      await other.goto(subscriptions);
      await other.locator('[data-stopit-strict-grid]').waitFor();
      assert.equal((await visited()).cutoff, start + 5 * 60_000);
    } finally {
      await other.close();
    }
    const latest = await visited();
    await home.goBack();
    await home.locator('[data-stopit-group="new"][data-id="' + ids.replay + '"]').waitFor();
    assert.deepEqual(await visited(), latest);
    healthy = false;
    await setWorkerTime(worker, start + 60 * 60_000);
    await home.reload();
    assert.deepEqual(await visited(), latest);
    healthy = true;
    await home.reload();
    await home.locator('[data-stopit-strict-grid]').waitFor();
    assert.equal((await visited()).cutoff, latest.lastVisit);
    assert.equal(await home.locator('[data-id="' + ids.replay + '"]').getAttribute('data-stopit-group'), 'older');
  } finally {
    await home.close();
    await resetStrict(worker);
  }
});

test('solo la pestaña activa con un reproductor cargado marca Vistos, también desde un enlace externo', async () => {
  const worker = await strictWorker();
  const home = await context.newPage();
  let account = strictAccount;
  const routes = '**/watch?*';
  const watch = async (route) => {
    if (!route.request().isNavigationRequest()) return route.fallback();
    const id = new URL(route.request().url()).searchParams.get('v');
    await route.fulfill({ contentType: 'text/html', body: signedInPage(watchPage(id) +
      '<div id="movie_player"><video preload="metadata"></video></div>', account) });
  };
  const seenKey = 'strictSeen:' + strictAccount + ':' + ids.newest;
  const wasOpened = () => worker.evaluate(async key => (await chrome.storage.local.get(key))[key], seenKey);
  await context.route(routes, watch);
  await home.route('**/feed/subscriptions*', route => route.fulfill({ contentType: 'text/html', body: signedInPage(feed(), account) }));
  let videoPage;
  try {
    await worker.evaluate(since => chrome.storage.local.set({ strictSince: since }), sinceJan2);
    await home.goto(subscriptions);
    await home.locator('[data-stopit-strict-grid]').waitFor();
    const pending = context.waitForEvent('page');
    const tabId = await worker.evaluate(async url => (await chrome.tabs.create({ url, active: false })).id, youtube + '/watch?v=' + ids.newest);
    videoPage = await pending;
    const player = videoPage.locator('#movie_player video');
    await player.waitFor({ state: 'attached' });
    // Loading a real media file in a background watch tab must not count as an opening.
    const load = () => player.evaluate(async el => {
      const ready = new Promise(resolve => el.addEventListener('loadedmetadata', resolve, { once: true }));
      el.src = 'data:audio/wav;base64,UklGRjQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRAAAACAgICAgICAgICAgICAgICA';
      await ready;
    });
    await load();
    assert.equal(await wasOpened(), undefined);
    await worker.evaluate(id => chrome.tabs.update(id, { active: true }), tabId);
    await videoPage.bringToFront();
    await home.locator('[data-id="' + ids.newest + '"][data-stopit-group="seen"]').waitFor({ state: 'attached', timeout: 5000 });
    assert.equal(await wasOpened(), true);
    await home.bringToFront();
    await home.getByRole('button', { name: labels.sectionWatched }).click();
    await home.locator('[data-id="' + ids.newest + '"][data-stopit-group="seen"]').waitFor();
    account = 'second||account';
    await home.reload();
    await home.locator('[data-id="' + ids.newest + '"][data-stopit-group="new"]').waitFor();
    await worker.evaluate(() => chrome.storage.local.set({ strictSince: 0 }));
    await videoPage.bringToFront();
    await videoPage.goto(youtube + '/watch?v=' + ids.replay, { waitUntil: 'commit' });
    await player.waitFor({ state: 'attached' });
    await load();
    assert.deepEqual(await worker.evaluate(() => chrome.storage.local.get('strictSeen:second||account:DDDDDDDDDDD')), {});
  } finally {
    await videoPage?.close();
    await home.close();
    await context.unroute(routes, watch);
    await resetStrict(worker);
  }
});

test('la clasificación usa únicamente las tarjetas cargadas y respeta los cambios de progreso', async () => {
  const worker = await strictWorker();
  const page = await context.newPage();
  const key = 'strictVisit:' + strictAccount;
  const single = '<ytd-browse page-subtype="subscriptions"><ytd-rich-grid-renderer><div id="contents">' +
    card(ids.newest).replace('<h3>', '<div class="ytThumbnailOverlayProgressBarHostProgressBarActiveSegment" style="width:20%"></div><h3>') +
    '</div></ytd-rich-grid-renderer></ytd-browse>';
  const watchRequests = [];
  try {
    await worker.evaluate(since => chrome.storage.local.set({ strictSince: since }), sinceJan2);
    await page.route('**/feed/subscriptions*', route => route.fulfill({ contentType: 'text/html', body: signedInPage(single) }));
    await page.route('**/watch?*', route => {
      watchRequests.push(route.request().url());
      return route.fulfill({ status: 429 });
    });
    await page.goto(subscriptions);
    const tile = page.locator('[data-id="' + ids.newest + '"]');
    await page.locator('[data-stopit-group="new"]').waitFor();
    await tile.evaluate(el => el.insertAdjacentHTML('beforeend', '<ytd-thumbnail-overlay-resume-playback-renderer><div id="progress" style="width:0%"></div></ytd-thumbnail-overlay-resume-playback-renderer>'));
    assert.equal(await tile.getAttribute('data-stopit-group'), 'new');
    await tile.locator('#progress').evaluate(el => { el.style.width = '1%'; });
    await page.locator('[data-stopit-group="seen"]').waitFor({ state: 'attached' });
    assert.equal(await tile.isVisible(), false);
    assert.ok(await page.getByRole('button', { name: labels.sectionNew }).isDisabled());
    assert.deepEqual(await page.locator('[data-stopit-heading] [aria-expanded="true"]').allTextContents(), [labels.sectionOlder]);
    await tile.evaluate((el, html) => el.insertAdjacentHTML('afterend', html), card(ids.older));
    await page.locator('[data-id="' + ids.older + '"][data-stopit-group="older"]').waitFor({ state: 'attached' });
    assert.ok((await worker.evaluate(key => chrome.storage.local.get(key), key))[key]);
    const older = page.getByRole('button', { name: labels.sectionOlder });
    await older.click();
    await tile.evaluate((el, html) => el.insertAdjacentHTML('afterend', html), card(ids.replay));
    await page.locator('[data-id="' + ids.replay + '"][data-stopit-group="new"]').waitFor({ state: 'attached' });
    assert.ok(await page.getByRole('button', { name: labels.sectionNew }).isEnabled());
    assert.equal(await older.getAttribute('aria-expanded'), 'true');
    assert.deepEqual(watchRequests, []);
  } finally {
    await page.close();
    await resetStrict(worker);
  }
});

test('Inicio y el panel clasifican lotes nativos sin consultar videos aunque /watch responda 429', async () => {
  const worker = await strictWorker();
  const home = await context.newPage();
  const watch = await context.newPage();
  const fetches = [];
  const errors = [];
  const text = value => '<span class="yt-content-metadata-view-model__metadata-text">' + value + '</span>';
  const initial = feed().replace(card(ids.newest), card(ids.newest, '12:34', text('hace 11 min')))
    .replace(card(ids.replay), card(ids.replay, '12:34', text('Streamed 5 hours ago')))
    .replace(card(ids.old), card(ids.old, '12:34', text('hace una semana')));
  const batch = card(ids.older, '10:00', text('2 weeks ago')) + card(ids.unknown, '08:15', '');
  // An external video still goes through the deliberate-navigation Shorts check.
  const target = 'VVVVVVVVVVV';
  const check = async route => {
    const request = route.request();
    const id = new URL(request.url()).searchParams.get('v');
    if (id === target) return route.fulfill({ contentType: 'text/html', body: watchPage(ids.replay).replaceAll(ids.replay, target) });
    fetches.push(request.url());
    return route.fulfill({ status: 429 });
  };
  await context.route('**/watch?*', check);
  for (const page of [home, watch]) {
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/feed/subscriptions*', route => route.fulfill({ contentType: 'text/html', body: signedInPage(initial) }));
  }
  try {
    await worker.evaluate(() => chrome.storage.local.set({ strictSince: Date.now() - 2 * 3_600_000 }));
    await watch.goto(youtube + '/watch?v=' + target, { waitUntil: 'commit' });
    await watch.locator('iframe[data-stopit-state="ready"]').waitFor();
    await home.goto(subscriptions);
    const panel = watch.frameLocator('.stopit-watch-panel iframe');
    for (const scope of [home, panel]) {
      await scope.locator('[data-stopit-group="new"][data-id="' + ids.newest + '"]').waitFor();
      await scope.getByRole('button', { name: labels.sectionOlder }).click();
      await scope.locator('[data-stopit-group="older"][data-id="' + ids.replay + '"]').waitFor();
      const sentinel = scope.locator('ytd-continuation-item-renderer');
      await sentinel.evaluate((el, batch) => {
        window.nativeBatch = document.createRange().createContextualFragment(batch);
        window.nativeFirst = window.nativeBatch.firstElementChild;
        el.before(window.nativeBatch);
      }, batch);
      await scope.locator('[data-id="' + ids.older + '"][data-stopit-group="older"]').waitFor();
      assert.ok(await sentinel.evaluate(el => el.parentElement.contains(window.nativeFirst)));
      // YouTube can hydrate a date after inserting the item or recycle the slot.
      await scope.locator('[data-id="' + ids.unknown + '"]').evaluate((el, html) => el.insertAdjacentHTML('beforeend', html), text('15 minutes ago'));
      await scope.locator('[data-id="' + ids.unknown + '"][data-stopit-group="new"]').waitFor({ state: 'attached' });
      assert.equal(await scope.getByRole('button', { name: labels.sectionOlder }).getAttribute('aria-expanded'), 'true');
      await scope.getByRole('button', { name: labels.sectionNew }).click();
      await scope.locator('[data-id="' + ids.unknown + '"][data-stopit-group="new"]').waitFor();
    }
    assert.deepEqual(fetches, []);
    assert.deepEqual(errors, []);
  } finally {
    await Promise.all([home.close(), watch.close()]);
    await context.unroute('**/watch?*', check);
    await resetStrict(worker);
  }
});

test('el orden nativo desempata fechas redondeadas después de una visita y de una recarga rápida', async () => {
  const worker = await strictWorker();
  const page = await context.newPage();
  const label = '<div id="metadata-line"><span>hace 1 h</span></div>';
  const top = card(ids.newest, '09:00', label);
  const old = card(ids.old, '08:00', label);
  let rows = old;
  const start = Date.now();
  const group = (id, name) => page.locator('[data-id="' + id + '"][data-stopit-group="' + name + '"]');
  await page.route('**/feed/subscriptions*', route => route.fulfill({ contentType: 'text/html',
    body: signedInPage('<ytd-browse page-subtype="subscriptions"><ytd-rich-grid-renderer><div id="contents">' +
      rows + '</div></ytd-rich-grid-renderer></ytd-browse>') }));
  try {
    await worker.evaluate(since => chrome.storage.local.set({ strictSince: since }), start - 2 * 3_600_000);
    await setWorkerTime(worker, start - 70 * 60_000);
    await page.goto(subscriptions);
    await page.locator('[data-stopit-strict-grid]').waitFor();
    await setWorkerTime(worker, start);
    rows = top + old;
    await page.reload();
    await group(ids.newest, 'new').waitFor();
    await group(ids.old, 'older').waitFor({ state: 'attached' });
    await setWorkerTime(worker, start + 2 * 60_000);
    await page.reload();
    await group(ids.newest, 'new').waitFor();
    await group(ids.old, 'older').waitFor({ state: 'attached' });
  } finally {
    await page.close();
    await resetStrict(worker);
  }
});

test('el acordeón mantiene sus tres controles visibles y recuerda el scroll de cada sección en Inicio y el panel', async () => {
  const worker = await strictWorker();
  const page = await context.newPage();
  const rows = Array.from({ length: 48 }, (_, n) => {
    const time = n < 12 ? '2025-01-03' : '2025-01-01';
    const progress = n >= 30 ? '<ytd-thumbnail-overlay-resume-playback-renderer><i id="progress" style="width:20%"></i></ytd-thumbnail-overlay-resume-playback-renderer>' : '';
    return card(String(n).padStart(11, '0'), '09:15', '<time datetime="' + time + 'T12:00:00Z"></time>' + progress);
  }).join('');
  const html = '<!doctype html>' + signedInPage('<style>body{margin:0}header{height:64px}ytd-browse,ytd-rich-grid-renderer{display:block}' +
    'ytd-rich-item-renderer{display:block;min-height:152px;width:33%}#contents{margin-block:4px}' +
    'ytd-continuation-item-renderer{display:block;height:20px}</style><header></header><ytd-browse page-subtype="subscriptions">' +
    '<ytd-rich-grid-renderer><div id="contents">' + rows + '<ytd-continuation-item-renderer></ytd-continuation-item-renderer>' +
    '</div></ytd-rich-grid-renderer></ytd-browse>');
  await page.route('**/feed/subscriptions*', route => route.fulfill({ contentType: 'text/html', body: html }));
  try {
    await worker.evaluate(since => chrome.storage.local.set({ strictSince: since }), sinceJan2);
    for (const sidebar of [false, true]) {
      await page.setViewportSize({ width: sidebar ? 760 : 1000, height: 640 });
      if (sidebar) {
        await page.goto(youtube + '/watch?v=' + ids.replay, { waitUntil: 'commit' });
        await page.locator('iframe[data-stopit-state="ready"]').waitFor();
      } else {
        await page.goto(subscriptions);
      }
      const scope = sidebar ? page.frameLocator('.stopit-watch-panel iframe') : page;
      const list = scope.locator('[data-stopit-strict-grid]');
      const older = scope.getByRole('button', { name: labels.sectionOlder });
      const seen = scope.getByRole('button', { name: labels.sectionWatched });
      await older.click();
      const bounds = () => list.evaluate(el => {
        const heads = [...document.querySelectorAll('[data-stopit-heading]')].map(h => h.getBoundingClientRect());
        const rect = el.getBoundingClientRect();
        return { heads: heads.map(h => h.top), first: heads[0].top, above: heads[1].bottom,
          below: heads[2].top, bottom: heads[2].bottom, listTop: rect.top, listBottom: rect.bottom,
          height: innerHeight, documentScroll: window.scrollY };
      });
      const start = await bounds();
      assert.ok(start.first >= 0 && start.above <= start.listTop && start.listBottom <= start.below);
      assert.ok(Math.abs(start.height - start.bottom) <= 1, JSON.stringify(start));
      await list.hover();
      await page.mouse.wheel(0, 450);
      const frame = sidebar ? page.frames().find(f => f.url().includes('stopit-panel=1')) : page.mainFrame();
      await frame.waitForFunction(() => document.querySelector('[data-stopit-strict-grid]').scrollTop > 0);
      const scroll = await list.evaluate(el => el.scrollTop);
      assert.ok(scroll > 0);
      assert.deepEqual(await bounds(), start);

      await seen.focus();
      await seen.press('Enter');
      assert.equal(await list.getAttribute('aria-labelledby'), await seen.getAttribute('id'));
      assert.equal(await seen.evaluate(el => el === document.activeElement), true);
      assert.equal(await older.getAttribute('aria-expanded'), 'false');
      assert.equal(await list.evaluate(el => el.scrollTop), 0);
      await list.evaluate(el => { el.scrollTop = 260; });
      await older.click();
      assert.equal(await list.evaluate(el => el.scrollTop), scroll);
      await page.setViewportSize({ width: sidebar ? 620 : 920, height: 480 });
      await list.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const smaller = await bounds();
      assert.ok(Math.abs(smaller.height - smaller.bottom) <= 1, JSON.stringify(smaller));

      const sentinel = list.locator('ytd-continuation-item-renderer');
      await sentinel.evaluate((el, extra) => {
        const observer = new IntersectionObserver(([entry]) => {
          if (entry.isIntersecting) {
            observer.disconnect();
            el.insertAdjacentHTML('beforebegin', extra);
          }
        });
        observer.observe(el);
      }, card(ids.older));
      await list.evaluate(el => { el.scrollTop = el.scrollHeight; });
      await list.locator('[data-id="' + ids.older + '"][data-stopit-group="older"]').waitFor();
      await seen.click();
      assert.equal(await list.evaluate(el => el.scrollTop), 260);
      await seen.click();
      assert.deepEqual(await scope.locator('[data-stopit-heading] [aria-expanded="true"]').allTextContents(), [labels.sectionOlder]);
      assert.ok(await list.locator('[data-stopit-group="older"]:visible').count() > 0);
    }
  } finally {
    await page.close();
    await resetStrict(worker);
  }
});

test('la rueda sobre una miniatura o su preview flotante mueve solo la sección abierta', async () => {
  const worker = await strictWorker();
  const page = await context.newPage();
  const rows = Array.from({ length: 30 }, (_, i) =>
    card(String(i).padStart(11, '0'), '09:00', '<time datetime="2025-01-03T12:00:00Z"></time>')
      .replace('<yt-thumbnail-badge-view-model>', '<img alt="Miniatura"><yt-thumbnail-badge-view-model>')
  ).join('');
  const html = '<!doctype html>' + signedInPage('<style>*{box-sizing:border-box}body{margin:0}header{height:56px}' +
    'main{height:calc(100dvh - 80px);overflow:auto}footer{height:600px}ytd-browse,ytd-rich-grid-renderer{display:block}' +
    'ytd-rich-item-renderer{width:50%;display:block;height:145px}img{display:block;width:130px;height:84px}' +
    'ytd-video-preview{display:block;position:fixed;z-index:9;width:130px;height:84px;background:#888}' +
    '</style><header></header><main><ytd-browse page-subtype="subscriptions"><ytd-rich-grid-renderer>' +
    '<div id="contents">' + rows + '<ytd-continuation-item-renderer></ytd-continuation-item-renderer></div>' +
    '</ytd-rich-grid-renderer></ytd-browse><footer></footer></main><footer></footer>');
  await page.route('**/feed/subscriptions*', route => route.fulfill({ contentType: 'text/html', body: html }));
  try {
    await worker.evaluate(since => chrome.storage.local.set({ strictSince: since }), sinceJan2);
    for (const sidebar of [false, true]) {
      if (sidebar) {
        await page.goto(youtube + '/watch?v=' + ids.replay, { waitUntil: 'commit' });
        await page.locator('iframe[data-stopit-state="ready"]').waitFor();
      } else await page.goto(subscriptions);
      const frame = sidebar ? page.frames().find(f => f.url().includes('stopit-panel=1')) : page.mainFrame();
      const list = frame.locator('[data-stopit-open="new"]');
      await list.waitFor();
      const thumb = list.locator('img').first();
      const positions = () => frame.evaluate(() => ({
        outer: [window.scrollY, document.querySelector('main').scrollTop],
        heads: [...document.querySelectorAll('[data-stopit-heading]')].map(el => el.getBoundingClientRect().top)
      }));
      const initial = await positions();
      // Hit the grid's padding, outside every card, to exercise native scrolling.
      await list.evaluate(el => el.style.setProperty('padding-left', '10px', 'important'));
      await list.hover({ position: { x: 3, y: 20 } });
      assert.equal(await list.evaluate(el => {
        const rect = el.getBoundingClientRect();
        return document.elementFromPoint(rect.left + 3, rect.top + 20) === el;
      }), true);
      await page.mouse.wheel(0, 80);
      await frame.waitForFunction(() => document.querySelector('#contents').scrollTop > 0, null, { timeout: 2500 });
      assert.deepEqual(await positions(), initial);
      await list.evaluate(el => { el.scrollTop = 0; });
      const fresh = frame.getByRole('button', { name: labels.sectionNew });
      const indicator = () => fresh.evaluate(el => getComputedStyle(el, '::after').animationName);
      const continuation = list.locator('ytd-continuation-item-renderer');
      assert.equal(await indicator(), 'none');
      await continuation.evaluate(el => el.insertAdjacentHTML('beforeend', '<tp-yt-paper-spinner active></tp-yt-paper-spinner>'));
      assert.equal(await indicator(), 'stopit-section-spin');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      assert.equal(await indicator(), 'none');
      await continuation.evaluate(el => el.replaceChildren());
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      assert.equal(await indicator(), 'none');
      assert.match(await fresh.evaluate(el => getComputedStyle(el.parentElement, '::before').backgroundImage), /linear-gradient/);

      // A gesture over the image must not reach the preview's own wheel handler.
      await thumb.evaluate(el => el.addEventListener('wheel', event => {
        event.preventDefault();
        document.querySelector('main').scrollBy(0, event.deltaY);
      }, { passive: false }));
      await thumb.hover();
      await page.mouse.wheel(0, 80);
      await frame.waitForFunction(() => document.querySelector('#contents').scrollTop > 0, null, { timeout: 2500 });
      assert.deepEqual(await positions(), initial);
      await list.evaluate(el => { el.scrollTop = 0; });
      // YouTube can put the hover player in a portal instead of inside the thumbnail.
      await thumb.evaluate(el => {
        const rect = el.getBoundingClientRect();
        const preview = document.createElement('ytd-video-preview');
        preview.style.setProperty('display', 'block', 'important');
        preview.style.left = rect.left + 'px';
        preview.style.top = rect.top + 'px';
        preview.innerHTML = '<video></video>';
        document.body.append(preview);
      });
      const preview = frame.locator('ytd-video-preview');
      await preview.hover();
      await page.mouse.wheel(0, 140);
      await frame.waitForFunction(() => document.querySelector('#contents').scrollTop > 0, null, { timeout: 2500 });
      assert.deepEqual(await positions(), initial);
      await list.evaluate(el => { el.scrollTop = el.scrollHeight; });
      await page.mouse.wheel(0, 420);
      await frame.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.deepEqual(await positions(), initial);
      await preview.evaluate(el => el.remove());
      const last = frame.locator('[data-stopit-heading="seen"]');
      const fits = await last.evaluate(el => {
        const main = document.querySelector('main');
        return el.getBoundingClientRect().bottom <= Math.min(innerHeight, main.getBoundingClientRect().bottom) + 1;
      });
      assert.ok(fits, 'Vistos debe quedar dentro del área visible');

      if (!sidebar) {
        // Open menus own their scroll even if drawn over the grid.
        await list.evaluate(el => {
          const menu = document.createElement('div');
          menu.setAttribute('role', 'menu');
          menu.style.cssText = 'position:fixed;top:45%;left:25%;height:60px;width:140px;z-index:10;overflow:auto';
          menu.innerHTML = '<div style="height:800px"></div>';
          document.body.append(menu);
        });
        const menu = frame.getByRole('menu');
        await menu.hover();
        await page.mouse.wheel(0, 80);
        await frame.waitForFunction(() => document.querySelector('[role="menu"]').scrollTop > 0);
        assert.deepEqual(await positions(), initial);
        await worker.evaluate(() => chrome.storage.local.set({ strictSince: 0 }));
        await list.waitFor({ state: 'detached' });
        assert.equal(await frame.locator('[data-stopit-scroll-lock]').count(), 0);
        assert.equal(await frame.locator('main').evaluate(el => getComputedStyle(el).overflowY), 'auto');
        await worker.evaluate(since => chrome.storage.local.set({ strictSince: since }), sinceJan2);
      } else {
        assert.equal(await page.locator('[data-stopit-scroll-lock]').count(), 0);
      }
    }
  } finally {
    await page.close();
    await resetStrict(worker);
  }
});
