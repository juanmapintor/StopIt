(() => {
  const watchPage = 'ytd-watch-flexy:not([hidden]), ytd-watch-grid:not([hidden])';
  const source = '/feed/subscriptions?stopit-panel=1';
  let slot,
    panel,
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
      loading: 'panelLoading',
      signedout: 'panelSignedOut',
      empty: 'panelEmpty',
      error: 'panelError'
    };
    message.textContent = messages[state] ? chrome.i18n.getMessage(messages[state]) : '';
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
    slot = document.createElement('div');
    slot.className = 'stopit-watch-slot';
    panel = document.createElement('section');
    panel.className = 'stopit-watch-panel';
    panel.lang = chrome.i18n.getMessage('languageCode');
    panel.setAttribute('aria-label', chrome.i18n.getMessage('subscriptions'));
    frame = document.createElement('iframe');
    frame.title = chrome.i18n.getMessage('subscriptionVideos');
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
    retry.textContent = chrome.i18n.getMessage('retry');
    retry.onclick = loadFeed;
    subscriptionsLink = document.createElement('a');
    subscriptionsLink.href = StopItRoutes.subscriptions;
    subscriptionsLink.textContent = chrome.i18n.getMessage('openSubscriptions');
    panel.append(frame, status, retry, subscriptionsLink);
    slot.append(panel);
    stateObserver = new MutationObserver(updateStatus);
    stateObserver.observe(frame, { attributes: true, attributeFilter: ['data-stopit-state'] });
    loadFeed();
  }

  // Measure the slot in the page flow, even while its panel is pinned.
  // Its position includes any player, chat or playlist above the feed.
  let sizeRequest, masthead;
  function measurePanel() {
    sizeRequest = undefined;
    if (!slot?.isConnected) return;
    if (!masthead?.isConnected) {
      masthead = document.getElementById('masthead-container') || document.querySelector('ytd-masthead');
      if (masthead) layoutObserver.observe(masthead);
    }
    const rect = slot.getBoundingClientRect();
    const watch = slot.closest(watchPage);
    const primary = watch?.querySelector('#primary')?.getBoundingClientRect();
    const sideBySide = primary?.width
      ? rect.left >= primary.right - 1 || rect.right <= primary.left + 1
      : watch?.hasAttribute('is-two-columns_') && Boolean(slot.closest('#secondary'));
    const barBottom = Math.max(0, masthead?.getBoundingClientRect().bottom || 0);
    const pinned = rect.width > 0 && sideBySide && rect.top <= barBottom;
    const top = pinned ? barBottom : Math.max(0, rect.top);
    slot.style.setProperty('--stopit-bar-bottom', barBottom + 'px');
    // Give the feed a usable viewport while the cinema player is still above the fold.
    slot.style.setProperty('--stopit-panel-top', (top >= innerHeight ? barBottom : top) + 'px');
    panel.toggleAttribute('data-stopit-pinned', Boolean(pinned));
    if (pinned) {
      // A transformed watch layout can anchor fixed positioning to its own padding box.
      const container = panel.offsetParent;
      const origin = container?.getBoundingClientRect();
      const left = container ? origin.left + container.clientLeft - container.scrollLeft : 0;
      const top = container ? origin.top + container.clientTop - container.scrollTop : 0;
      slot.style.setProperty('--stopit-pin-top', (barBottom - top) + 'px');
      slot.style.setProperty('--stopit-panel-left', (rect.left - left) + 'px');
      slot.style.setProperty('--stopit-panel-width', rect.width + 'px');
    }
  }
  function scheduleMeasure() {
    if (sizeRequest === undefined) sizeRequest = requestAnimationFrame(measurePanel);
  }
  const layoutObserver = new ResizeObserver(scheduleMeasure);
  const viewObserver = new MutationObserver(scheduleMeasure);

  function unmount() {
    clearTimeout(timeout);
    layoutObserver.disconnect();
    viewObserver.disconnect();
    window.removeEventListener('scroll', scheduleMeasure, true);
    window.removeEventListener('resize', scheduleMeasure);
    cancelAnimationFrame(sizeRequest);
    sizeRequest = undefined;
    stateObserver?.disconnect();
    slot?.remove();
    slot = panel = frame = status = message = retry = subscriptionsLink = relatedBlock = masthead = null;
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
    if (slot?.parentElement === parent && (!related || related.nextElementSibling === slot)) {
      scheduleMeasure();
      return;
    }
    if (panel) unmount();
    createPanel();
    if (related) related.after(slot);
    else parent.append(slot);
    relatedBlock = related;
    measurePanel();
    layoutObserver.observe(parent);
    layoutObserver.observe(watch);
    viewObserver.observe(watch, { attributes: true, attributeFilter: ['theater', 'is-two-columns_'] });
    window.addEventListener('resize', scheduleMeasure);
    window.addEventListener('scroll', scheduleMeasure, { capture: true, passive: true });
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
    if (relatedBlock?.isConnected && relatedBlock.nextElementSibling === slot) return;
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
