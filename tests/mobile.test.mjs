import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { firefox, webkit } from 'playwright-core';

const script = fileURLToPath(new URL('../mobile/stopit.user.js', import.meta.url));
const origin = 'https://m.youtube.com';
const subscriptions = origin + '/feed/subscriptions';
const video = 'Ordinary123';
const short = 'ShortClip12';
const target = origin + '/watch?v=' + video + '&t=37&list=PLtest';

function shelf() {
  return '<ytm-rich-section-renderer class="shorts"><h2>Shorts</h2><ytm-reel-shelf-renderer>' +
    '<a href="/shorts/' + short + '">Clip</a></ytm-reel-shelf-renderer></ytm-rich-section-renderer>';
}
function fixture(url) {
  const id = url.searchParams.get('v');
  const canonical = id === short ? '/shorts/' + id : '/watch?v=' + video;
  const head = '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<style>ytm-rich-item-renderer,ytm-rich-section-renderer,ytm-pivot-bar-item-renderer {display:block}</style>';
  const home = '<a href="/">Inicio</a>';
  if (url.pathname === '/watch' || url.pathname.startsWith('/live/')) {
    return '<head>' + head + '<link rel="canonical" href="https://www.youtube.com' + canonical +
      '"></head><body><div id="player-container-id"><video></video></div><ytm-watch>' +
      '<div class="watch-below-the-player"><ytm-single-column-watch-next-results-renderer>' +
      '<ytm-item-section-renderer section-identifier="related-items">Sugerencias</ytm-item-section-renderer>' +
      '<p>Comentarios</p></ytm-single-column-watch-next-results-renderer></div></ytm-watch>' + home;
  }
  return '<head>' + head + '</head><body>' + home + '<ytm-pivot-bar-item-renderer><div class="pivot-shorts">' +
    'Shorts</div></ytm-pivot-bar-item-renderer><main>' + shelf() + '<ytm-rich-item-renderer>' +
    '<a href="' + target + '">Video normal</a></ytm-rich-item-renderer></main>';
}

for (const engine of [webkit, firefox]) {
  describe('Userscript móvil en ' + engine.name(), () => {
    let browser, page;
    before(async () => { browser = await engine.launch(); });
    after(async () => { await browser?.close(); });
    beforeEach(async () => {
      page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'es-AR', hasTouch: true });
      page.setDefaultTimeout(5000);
      await page.addInitScript({ path: script });
      await page.route('https://*.youtube.com/**', route => route.fulfill({
        contentType: 'text/html', body: fixture(new URL(route.request().url()))
      }));
    });
    afterEach(async () => { await page?.close(); });

    test('abre Suscripciones en el host actual desde Inicio y desde Shorts', async () => {
      for (const [host, path] of [[origin, '/?app=m'], ['https://www.youtube.com', '/shorts/' + short],
        [origin, '/feed/subscriptions/shorts']]) {
        await page.goto(host + path, { waitUntil: 'commit' });
        await page.waitForURL(host + '/feed/subscriptions');
      }
      await page.goto(origin + '/results?search_query=test');
      await page.getByRole('link', {name: 'Inicio'}).click();
      await page.waitForURL(subscriptions);
      await page.goBack();
      assert.match(page.url(), /\/results\?/);
    });

    test('oculta filas, tarjetas y accesos a Shorts, incluso al cargar o reciclar tarjetas', async () => {
      await page.goto(subscriptions);
      assert.equal(await page.locator('.shorts').isVisible(), false);
      assert.equal(await page.locator('ytm-pivot-bar-item-renderer').isVisible(), false);
      await page.locator('main').evaluate((main, html) => main.insertAdjacentHTML('beforeend', html), shelf());
      assert.equal(await page.locator('.shorts:visible').count(), 0);
      const card = page.locator('ytm-rich-item-renderer');
      assert.ok(await card.isVisible());
      await card.locator('a').evaluate((a, id) => a.href = '/shorts/' + id, short);
      assert.equal(await card.isVisible(), false);
      await card.locator('a').evaluate((a, href) => a.href = href, target);
      assert.ok(await card.isVisible());
    });

    test('conserva el enlace normal y repone el botón si YouTube reconstruye el reproductor', async () => {
      await page.goto(subscriptions);
      await page.getByRole('link', {name: 'Video normal'}).click();
      await page.waitForURL(target);
      const button = page.getByRole('link', {name: 'Volver a mis suscripciones'});
      await button.waitFor();
      assert.ok(await page.getByText('Comentarios').isVisible());
      assert.equal(await page.getByText('Sugerencias').isVisible(), false);
      await page.locator('.watch-below-the-player').evaluate(el => el.replaceWith(el.cloneNode(false)));
      await button.waitFor();
      assert.equal(await button.count(), 1);
      await button.click();
      await page.waitForURL(subscriptions);
      assert.equal(await button.count(), 0);
    });

    test('ofrece volver al feed desde un directo y permite seguir viendo si falta la URL canónica', async () => {
      await page.goto(origin + '/live/' + video);
      const button = page.getByRole('link', {name: 'Volver a mis suscripciones'});
      await button.waitFor();
      await page.route('**/watch?*', route => route.fulfill({
        contentType: 'text/html', body: '<ytm-watch><div class="watch-below-the-player">Video</div></ytm-watch>'
      }));
      await page.goto(target);
      await button.waitFor();
      assert.equal(page.url(), target);
    });

    test('reconoce un Short compartido como watch y una navegación interna con metadatos viejos', async () => {
      await page.goto(origin + '/watch?v=' + short, { waitUntil: 'commit' });
      await page.waitForURL(subscriptions);
      await page.goto(target);
      await page.evaluate(id => {
        history.pushState({}, '', '/watch?v=' + id + '#t=2');
        document.dispatchEvent(new Event('yt-navigate-finish'));
      }, short);
      await page.waitForURL(subscriptions);
    });

    test('usa el ID del video actual y deja en paz los reproductores embebidos', async () => {
      await page.goto(target);
      await page.evaluate(id => document.querySelector('link[rel="canonical"]').href = '/shorts/' + id, short);
      await page.getByRole('link', {name: 'Volver a mis suscripciones'}).waitFor();
      assert.equal(page.url(), target);
      await page.evaluate(id => {
        const frame = document.createElement('iframe');
        frame.src = '/shorts/' + id;
        document.body.append(frame);
      }, short);
      await page.frameLocator('iframe').locator('main').waitFor();
      assert.ok(page.frames().some(frame => frame.url() === origin + '/shorts/' + short));
      await page.evaluate(id => document.querySelector('link[rel="canonical"]').href = '/shorts/' + id, video);
      await page.waitForURL(subscriptions);
    });
  });
}
