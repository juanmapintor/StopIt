(() => {
  const watchPage = 'ytd-watch-flexy:not([hidden]), ytd-watch-grid:not([hidden])';
  const source = '/feed/subscriptions?stopit-panel=1';
  let panel,
    frame,
    status,
    message,
    subscriptionsLink,
    retry,
    timeout,
    relatedBlock,
    scheduled = false;

  function updateStatus() {
    const state = frame.dataset.stopitState;
    if (state !== 'loading') clearTimeout(timeout);
    const messages = {
      loading: 'Cargando suscripciones…',
      signedout: 'Abrí Suscripciones para iniciar sesión.',
      empty: 'No hay videos en tus suscripciones.',
      error: 'No se pudieron cargar tus suscripciones.'
    };
    message.textContent = messages[state] || '';
    status.hidden = state === 'ready';
    subscriptionsLink.hidden = state === 'loading' || state === 'ready';
    retry.hidden = state !== 'error';
    frame.tabIndex = state === 'ready' ? 0 : -1;
  }

  function loadFeed() {
    clearTimeout(timeout);
    frame.dataset.stopitState = 'loading';
    frame.src = source;
    updateStatus();
    timeout = setTimeout(() => {
      if (frame?.dataset.stopitState === 'loading') frame.dataset.stopitState = 'error';
    }, 15000);
  }

  let stateObserver;
  function createPanel() {
    panel = document.createElement('section');
    panel.className = 'stopit-watch-panel';
    panel.setAttribute('aria-label', 'Suscripciones');
    frame = document.createElement('iframe');
    frame.title = 'Videos de tus suscripciones';
    frame.addEventListener('load', () => {
      if (!frame || frame.dataset.stopitState !== 'loading') return;
      const doc = frame.contentDocument;
      if (!doc || (doc.URL !== 'about:blank' && !doc.querySelector('ytd-app, ytd-browse'))) {
        frame.dataset.stopitState = 'error';
      }
    });
    frame.setAttribute('allow', "autoplay 'none'; camera 'none'; microphone 'none'");
    status = document.createElement('p');
    status.setAttribute('role', 'status');
    message = document.createElement('span');
    status.append(message);
    retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Reintentar';
    retry.onclick = loadFeed;
    subscriptionsLink = document.createElement('a');
    subscriptionsLink.href = StopItRoutes.subscriptions;
    subscriptionsLink.textContent = 'Abrir Suscripciones';
    panel.append(frame, status, retry, subscriptionsLink);
    stateObserver = new MutationObserver(updateStatus);
    stateObserver.observe(frame, { attributes: true, attributeFilter: ['data-stopit-state'] });
    loadFeed();
  }

  // Chat, playlists and the watch layout can all move the top of the list.
  let sizeRequest;
  function measurePanel() {
    sizeRequest = undefined;
    if (!panel?.isConnected) return;
    const top = Math.max(0, panel.getBoundingClientRect().top);
    panel.style.setProperty('--stopit-panel-top', top + 'px');
  }
  function scheduleMeasure() {
    if (sizeRequest === undefined) sizeRequest = requestAnimationFrame(measurePanel);
  }
  const layoutObserver = new ResizeObserver(scheduleMeasure);

  function unmount() {
    clearTimeout(timeout);
    layoutObserver.disconnect();
    window.removeEventListener('scroll', scheduleMeasure);
    window.removeEventListener('resize', scheduleMeasure);
    cancelAnimationFrame(sizeRequest);
    sizeRequest = undefined;
    stateObserver?.disconnect();
    panel?.remove();
    panel = frame = status = message = retry = subscriptionsLink = relatedBlock = null;
  }

  function mount() {
    scheduled = false;
    const url = new URL(location.href);
    if (!StopItRoutes.videoId(url) || url.pathname.startsWith('/embed/')) {
      if (panel) unmount();
      return;
    }
    const watch = document.querySelector(watchPage);
    if (!watch) {
      if (panel && !panel.isConnected) unmount();
      return;
    }
    const renderer = watch.querySelector('ytd-watch-next-secondary-results-renderer');
    const related =
      renderer?.closest('#related') ||
      renderer ||
      watch.querySelector('#secondary-inner > #related, #below > #related');
    const parent = related?.parentElement || watch.querySelector('#secondary-inner, #secondary');
    if (!parent) return;
    if (panel?.parentElement === parent && (!related || related.nextElementSibling === panel)) return;
    if (panel) unmount();
    createPanel();
    if (related) related.after(panel);
    else parent.append(panel);
    relatedBlock = related;
    measurePanel();
    layoutObserver.observe(parent);
    layoutObserver.observe(watch);
    window.addEventListener('resize', scheduleMeasure);
    window.addEventListener('scroll', scheduleMeasure, { passive: true });
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(mount);
  }

  // Watch containers can be stamped late or replaced on a responsive layout change.
  const targets =
    watchPage + ', #secondary-inner, #secondary, #related, ytd-watch-next-secondary-results-renderer';
  const observer = new MutationObserver((records) => {
    if (!StopItRoutes.videoId(new URL(location.href))) return;
    if (panel && !panel.isConnected) return schedule();
    if (relatedBlock?.isConnected && relatedBlock.nextElementSibling === panel) return;
    if (
      records.some((record) =>
        [...record.addedNodes].some(
          (node) => node.nodeType === 1 && (node.matches(targets) || node.querySelector(targets))
        )
      )
    )
      schedule();
  });
  observer.observe(document, { childList: true, subtree: true });
  document.addEventListener('yt-navigate-finish', schedule);
  document.addEventListener('yt-page-data-updated', schedule);
  navigation.addEventListener('currententrychange', schedule);
  window.addEventListener('pageshow', schedule);
  schedule();
})();
