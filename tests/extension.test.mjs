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
    '"><h3><a href="/watch?v=' +
    id +
    '">' +
    id +
    '</a></h3>' +
    '<yt-thumbnail-badge-view-model><span class="ytBadgeShapeText">' +
    badge +
    '</span></yt-thumbnail-badge-view-model></ytd-rich-item-renderer>'
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
    '<h1>Player</h1><button>Play</button>'
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
