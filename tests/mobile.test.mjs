import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { firefox, webkit } from 'playwright-core';

const script = await readFile(new URL('../mobile/stopit.user.js', import.meta.url), 'utf8');
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
  const account = '<script>window.ytcfg = {set() {}}; ytcfg.set({"LOGGED_IN":true,"DATASYNC_ID":"test-account"});</script>';
  const head = account + '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<style>ytm-rich-item-renderer,ytm-rich-section-renderer,ytm-pivot-bar-item-renderer {display:block}</style>';
  const home = '<a href="/">Inicio</a>';
  if (url.pathname === '/watch' || url.pathname.startsWith('/live/')) {
    return '<head>' + head + '<link rel="canonical" href="https://www.youtube.com' + canonical +
      '"><meta itemprop="datePublished" content="2025-01-10"></head><body><div id="player-container-id"><video></video></div><ytm-watch>' +
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
    let browser, context, page, values;
    before(async () => { browser = await engine.launch(); });
    after(async () => { await browser?.close(); });
    beforeEach(async () => {
      context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-AR', hasTouch: true });
      page = await context.newPage();
      page.setDefaultTimeout(5000);
      values = new Map();
      await context.exposeBinding('gmRead', (_, key) => values.get(key));
      await context.exposeBinding('gmWrite', (_, key, value) => { values.set(key, value); });
      await context.addInitScript({ content: 'const GM = {getValue: gmRead, setValue: gmWrite};\n' + script });
      await page.route('https://*.youtube.com/**', route => route.fulfill({
        contentType: 'text/html', body: fixture(new URL(route.request().url()))
      }));
    });
    afterEach(async () => { await context?.close(); });

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

    test('abre Suscripciones desde youtube.com si Safari activa tarde una pestaña precargada', async () => {
      const cold = await browser.newPage();
      try {
        await cold.route('https://youtube.com/**', route => route.fulfill({contentType:'text/html', body:'<main>YouTube</main>'}));
        await cold.goto('https://youtube.com/');
        await cold.evaluate(() => {
          window.GM = { getValue: async () => undefined, setValue: async () => {} };
          Object.defineProperty(document, 'prerendering', {configurable:true, value:true});
          // Cancel the first navigation, as can happen while a tab is being activated.
          window.navigation?.addEventListener('navigate', event => {
            if (event.cancelable) { event.preventDefault(); sessionStorage.setItem('interrupted', 'yes'); }
          }, {once:true});
        });
        await cold.evaluate(script);
        assert.equal(cold.url(), 'https://youtube.com/');
        await cold.evaluate(() => {
          Object.defineProperty(document, 'prerendering', {configurable:true, value:false});
          document.dispatchEvent(new Event('prerenderingchange'));
        });
        await cold.waitForURL('https://youtube.com/feed/subscriptions', {timeout:5000});
        if (await cold.evaluate(() => Boolean(window.navigation))) {
          assert.equal(await cold.evaluate(() => sessionStorage.getItem('interrupted')), 'yes');
        }
      } finally { await cold.close(); }
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

    test('ofrece volver al feed desde un directo y reintentar si faltan los metadatos', async () => {
      await page.goto(origin + '/live/' + video);
      const button = page.getByRole('link', {name: 'Volver a mis suscripciones'});
      await button.waitFor();
      await page.route('**/watch?*', route => route.fulfill({
        contentType: 'text/html', body: '<ytm-watch><div class="watch-below-the-player">Video</div></ytm-watch>'
      }));
      await page.goto(target);
      await page.getByRole('button', {name: 'Reintentar'}).waitFor();
      assert.equal(await page.locator('html').getAttribute('data-stopit-verifying'), '');
      await page.getByRole('link', {name: 'Ir a Suscripciones'}).click();
      await page.waitForURL(subscriptions);
    });

    test('los ajustes persisten y controlan la campana sin ocultar el resto de la cabecera', async () => {
      await page.goto(subscriptions);
      await page.evaluate(() => {
        const header = document.createElement('header');
        header.className = 'mobile-topbar-header';
        header.innerHTML = '<button aria-label="Notificaciones">Campana</button><button>Buscar</button>';
        document.body.prepend(header);
      });
      const bell = page.getByText('Campana', {exact:true});
      assert.equal(await bell.isVisible(), false);
      const settings = page.getByRole('button', {name: 'Ajustes de StopIt'});
      await settings.click();
      const notifications = page.getByRole('switch', {name: 'Mostrar notificaciones'});
      const strict = page.getByRole('switch', {name: 'Modo estricto'});
      assert.equal(await strict.isChecked(), false);
      await notifications.check();
      await strict.check();
      await page.getByRole('button', {name: 'Cerrar'}).click();
      await bell.waitFor();
      assert.ok(await page.getByRole('button', {name: 'Buscar'}).isVisible());
      await page.reload();
      await settings.click();
      assert.ok(await notifications.isChecked());
      assert.ok(await strict.isChecked());
      await strict.uncheck();
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({state:'hidden'});
      assert.equal(values.get('strictSince'), 0);
    });

    test('Mostrar botón Crear persiste y actualiza las cabeceras móviles independientemente de la campana', async () => {
      const other = await context.newPage();
      try {
        for (const tab of [page, other]) {
          await tab.route(subscriptions, route => route.fulfill({ contentType: 'text/html', body: `
            <ytm-mobile-topbar-renderer><header class="mobile-topbar-header">
              <ytm-button-renderer><a id="create" href="/upload">Subir</a></ytm-button-renderer>
              <button aria-label="Notificaciones">Campana</button><button>Buscar</button>
            </header></ytm-mobile-topbar-renderer><main><button>Crear</button></main>` }));
          await tab.goto(subscriptions);
          assert.equal(await tab.locator('#create').isVisible(), false);
          assert.ok(await tab.getByRole('button', { name: 'Buscar' }).isVisible());
          assert.ok(await tab.locator('main button').isVisible());
        }
        const settings = page.getByRole('button', { name: 'Ajustes de StopIt' });
        const toggle = page.getByRole('switch', { name: 'Mostrar botón Crear' });
        const otherBell = other.getByText('Campana', { exact: true });
        await settings.click();
        assert.equal(await toggle.isChecked(), false);
        await toggle.check();
        await other.locator('#create').waitFor();
        assert.equal(await otherBell.isVisible(), false);
        await page.reload();
        await page.locator('#create').waitFor();
        await settings.click();
        assert.ok(await toggle.isChecked());
        await page.getByRole('switch', { name: 'Mostrar notificaciones' }).check();
        await toggle.uncheck();
        await other.locator('#create').waitFor({ state: 'hidden' });
        await otherBell.waitFor();
      } finally {
        await other.close();
      }
    });

    test('quita la promoción de la app al cargar y al reinsertarse sin tocar otras promociones ni Buscar', async () => {
      await page.goto(subscriptions);
      await page.evaluate(() => {
        document.head.insertAdjacentHTML('beforeend', '<meta name="apple-itunes-app" content="app-id=544007664">');
        document.body.insertAdjacentHTML('afterbegin', '<header class="mobile-topbar-header"><button>Buscar</button>' +
          '<button>Abrir en la aplicación</button></header><ytm-mealbar-promo-renderer id="install">' +
          '<a href="https://play.google.com/store/apps/details?id=com.google.android.youtube">Descargar</a>' +
          '</ytm-mealbar-promo-renderer><ytm-mealbar-promo-renderer id="other"><a href="/premium">Premium</a></ytm-mealbar-promo-renderer>');
      });
      await page.waitForFunction(() => !document.querySelector('meta[name="apple-itunes-app"]') &&
        document.querySelector('#install').getClientRects().length === 0);
      assert.equal(await page.getByText('Abrir en la aplicación').isVisible(), false);
      assert.ok(await page.getByRole('button', {name:'Buscar'}).isVisible());
      assert.ok(await page.getByText('Premium').isVisible());
    });

    test('muestra las secciones en la grilla móvil sin reservar espacio para canales ni filtros vacíos', async () => {
      function card(id, age, watched = false) {
        return `<ytm-rich-item-renderer><ytm-compact-video-renderer>
          <a aria-hidden="true" href="/watch?v=${id}"><img alt=""></a>
          <a href="/watch?v=${id}"><h4 class="YtmCompactMediaItemHeadline">${id}</h4>
            <div class="YtmCompactMediaItemStats">${age}</div></a>
          ${watched ? '<div class="ytwThumbnailOverlayResumePlaybackRendererThumbnailOverlayResumePlaybackProgress" style="width:40%"></div>' : ''}
        </ytm-compact-video-renderer></ytm-rich-item-renderer>`;
      }
      const recent = 'NewVideo123', watched = 'Watched1234';
      const strip = '<ytm-channel-list-sub-menu-renderer><a href="/feed/channels">Canales</a></ytm-channel-list-sub-menu-renderer>';
      const bar = '<div class="rich-grid-sticky-header"><ytm-feed-filter-chip-bar-renderer></ytm-feed-filter-chip-bar-renderer></div>';
      const list = '<div class="rich-grid-renderer-contents">' + strip + card(recent, 'hace 1 hora') +
        card(video, 'hace 3 días') + card(watched, 'hace 4 días', true) + '</div>';
      await page.route(subscriptions, route => route.fulfill({ contentType: 'text/html', body: `
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <style>body{margin:0}ytm-app,ytm-tab-renderer,ytm-rich-grid-renderer,ytm-rich-item-renderer,
          ytm-channel-list-sub-menu-renderer{display:block}.mobile-topbar-header{height:48px}
          .rich-grid-sticky-header{margin-bottom:50px}ytm-pivot-bar-renderer{position:fixed;bottom:0;height:56px}
          h2{max-height:2.5em;overflow:hidden}</style>
        <script type="application/json">ytcfg.set({"LOGGED_IN":true,"DATASYNC_ID":"mobile-A"})</script>
        <ytm-app><header class="mobile-topbar-header"><div class="mobile-topbar-header-content"></div></header>
        <ytm-browse><div class="tab-content" tab-identifier="FEsubscriptions"><ytm-tab-renderer>
        <ytm-rich-grid-renderer></ytm-rich-grid-renderer></ytm-tab-renderer></div></ytm-browse>
        <ytm-pivot-bar-renderer>Suscripciones</ytm-pivot-bar-renderer></ytm-app>` }));
      await page.goto(subscriptions);
      const grid = page.locator('ytm-rich-grid-renderer');
      await grid.waitFor({ state: 'attached' });
      await grid.evaluate((el, html) => el.innerHTML = html, bar + list);
      const channels = grid.locator('ytm-channel-list-sub-menu-renderer');
      await channels.waitFor({ state: 'hidden' });
      const header = page.locator('.mobile-topbar-header');
      assert.equal((await grid.locator('ytm-rich-item-renderer').first().boundingBox()).y, (await header.boundingBox()).height);
      const filters = grid.locator('ytm-feed-filter-chip-bar-renderer');
      await filters.evaluate(el => el.innerHTML = '<button>Todos</button>');
      await page.getByRole('button', { name: 'Todos' }).waitFor();
      await filters.evaluate(el => el.classList.add('filter-chip-bar-out'));
      assert.equal(await grid.locator('.rich-grid-sticky-header').evaluate(el => getComputedStyle(el).marginBottom), '0px');
      await filters.evaluate(el => el.replaceChildren());

      const settings = page.getByRole('button', { name: 'Ajustes de StopIt' });
      assert.equal(await settings.textContent(), '');
      await settings.locator('img').evaluate(img => img.decode());
      assert.ok((await settings.boundingBox()).width >= 44);
      await settings.click();
      const strict = page.getByRole('switch', { name: 'Modo estricto' });
      assert.equal(await strict.isChecked(), false);
      await strict.check();
      await page.getByRole('button', { name: 'Cerrar' }).click();
      // Reopen the feed with a saved cutoff between the first and second uploads.
      values.set('strictSince', Date.now() - 2 * 86400_000);
      await page.reload();
      await grid.evaluate((el, html) => el.innerHTML = html, bar + list);
      const listElement = grid.locator('.rich-grid-renderer-contents');
      await page.locator('.rich-grid-renderer-contents[data-stopit-open="new"]').waitFor();
      for (const [name, id] of [['Nuevos', recent], ['Anteriores', video], ['Vistos', watched]]) {
        const section = page.getByRole('button', { name, exact: true });
        const rect = await section.boundingBox();
        assert.ok(rect.y >= 48 && rect.y + rect.height <= (await page.locator('ytm-pivot-bar-renderer').boundingBox()).y);
        if (await section.getAttribute('aria-expanded') === 'false') await section.click();
        assert.deepEqual(await listElement.locator('h4:visible').allTextContents(), [id]);
      }
      await grid.evaluate(el => el.querySelectorAll('[data-stopit-heading]').forEach(h => h.remove()));
      await page.getByRole('button', { name: 'Vistos', exact: true }).waitFor();
      assert.equal(await listElement.getAttribute('data-stopit-open'), 'seen');
      await grid.evaluate((el, html) => el.querySelector('.rich-grid-renderer-contents').outerHTML = html, list);
      await grid.locator('.rich-grid-renderer-contents[data-stopit-strict-grid]').waitFor();
      assert.equal(await grid.locator('[data-stopit-heading]').count(), 3);
      assert.equal(await channels.isVisible(), false);
      await page.evaluate(() => {
        history.pushState({}, '', '/feed/channels');
        document.dispatchEvent(new Event('yt-navigate-finish'));
      });
      await channels.waitFor();
    });

    test('Nuevos, Anteriores y Vistos comparten el corte del feed y el historial por cuenta con el panel', async () => {
      await page.goto(origin + '/results');
      await page.getByRole('button', {name:'Ajustes de StopIt'}).click();
      await page.getByRole('switch', {name:'Modo estricto'}).check();
      await page.getByRole('button', {name:'Cerrar'}).click();
      const since = values.get('strictSince');
      const ids = ['NewVideo123', video, 'Watched1234'];
      function card(id, date, progress) {
        return '<ytm-rich-item-renderer><h3><a href="/watch?v=' + id + '">' + id + '</a></h3><time datetime="' +
          new Date(date).toISOString() + '"></time>' + (progress ? '<ytm-thumbnail-overlay-resume-playback-renderer>' +
          '<div class="thumbnail-overlay-resume-playback-progress" style="width:50%"></div></ytm-thumbnail-overlay-resume-playback-renderer>' : '') + '</ytm-rich-item-renderer>';
      }
      let owner = 'account-A';
      await page.route('**/feed/subscriptions*', route => route.fulfill({contentType:'text/html',
        body: '<script type="application/json">ytcfg.set({"LOGGED_IN":true,"DATASYNC_ID":"' + owner + '"})</script>' +
          '<ytm-app><ytm-browse><div class="tab-content" tab-identifier="FEsubscriptions"><ytm-rich-grid-renderer>' +
          card(ids[0], since + 1, false) + card(video, since - 10, false) + card(ids[2], since - 20, true) +
          '</ytm-rich-grid-renderer></div></ytm-browse></ytm-app>'}));
      await page.goto(subscriptions);
      await page.locator('[data-stopit-open="new"]').waitFor();
      const section = (scope, name) => scope.getByRole('button', {name, exact:true});
      assert.deepEqual(await page.locator('[data-stopit-group]:visible h3').allTextContents(), [ids[0]]);
      await section(page, 'Vistos').click();
      assert.deepEqual(await page.locator('[data-stopit-group]:visible h3').allTextContents(), [ids[2]]);
      await section(page, 'Anteriores').click();
      const visit = values.get('strictVisit:account-A');
      await page.locator('[data-stopit-group="older"] a').click();
      const panel = page.frameLocator('.stopit-watch-panel iframe');
      await section(panel, 'Anteriores').click();
      assert.equal(await panel.locator('[aria-current="true"]').innerText(), video);
      assert.deepEqual(values.get('strictVisit:account-A'), visit);
      await panel.locator('[aria-current="true"]').click();
      await page.waitForURL(origin + '/watch?v=' + video);
      await page.evaluate(() => {
        document.querySelector('script:not([src])').textContent = 'ytcfg.set({"LOGGED_IN":true,"DATASYNC_ID":"account-A"})';
        const player = document.querySelector('video');
        Object.defineProperty(player, 'readyState', {value:2});
        document.dispatchEvent(new Event('yt-page-data-updated'));
        player.dispatchEvent(new Event('loadedmetadata'));
      });
      await page.waitForFunction(async id => await gmRead('strictSeen:account-A:' + id) === true, video);
      owner = 'account-B';
      await page.goto(subscriptions);
      await section(page, 'Vistos').click();
      assert.deepEqual(await page.locator('[data-stopit-group]:visible h3').allTextContents(), [ids[2]]);
      assert.equal(values.has('strictSeen:account-B:' + video), false);
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
      await page.frameLocator('iframe[src^="/shorts/"]').locator('main').waitFor();
      assert.ok(page.frames().some(frame => frame.url() === origin + '/shorts/' + short));
      await page.evaluate(id => document.querySelector('link[rel="canonical"]').href = '/shorts/' + id, video);
      await page.waitForURL(subscriptions);
    });
  });
}
