(() => {
  const notificationMenu = [
    'ytd-multi-page-menu-renderer[menu-style="multi-page-menu-style-type-notifications"]',
    'ytd-popup-container ytd-notification-section-renderer'
  ].join(', ');
  function observeTopBar() {
    const root = document.documentElement;
    StopItPreferences.observe('showCreateButton', show => {
      root.toggleAttribute('data-stopit-show-create', show === true);
    });
    StopItPreferences.observe('showNotifications', show => {
      if (!show && root.hasAttribute('data-stopit-show-notifications')) {
        const open = [...document.querySelectorAll(notificationMenu)].some(menu =>
          menu.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true })
        );
        if (open) {
          // Dismiss the native dropdown before hiding its trigger.
          document.querySelector('ytd-notification-topbar-button-renderer button')?.click();
        }
      }
      root.toggleAttribute('data-stopit-show-notifications', show === true);
    });
  }
  if (document.documentElement) observeTopBar();
  else document.addEventListener('DOMContentLoaded', observeTopBar, { once: true });

  const masthead = ':is(ytd-masthead, ytm-header, ytm-mobile-topbar-renderer, .mobile-topbar-header)';
  const controls = [
    masthead + ' a', 'ytd-guide-entry-renderer', 'ytd-mini-guide-entry-renderer', 'ytd-search-filter-renderer',
    'ytm-chip-cloud-chip-renderer', 'ytm-pivot-bar-item-renderer', '.single-column-browse-results-tabs a', 'yt-chip-cloud-chip-renderer', '.ytChipBarViewModelChipWrapper', 'chip-view-model', 'yt-chip-view-model',
    'chip-shape', 'yt-tab-shape', 'tp-yt-paper-tab', '[role="tab"]', 'button', '[role="button"]:not(a[href])'
  ].join(', ');
  const labels = '#title, .title, #text, .ytChipShapeText, .ytTabShapeTab, yt-formatted-string';
  const isShorts = (value) => /^(?:YouTube\s+)?Shorts$/i.test(value?.trim() || '');
  const createLabel = /^(?:\+\s*)?(?:create|crear|create a video or post|crear un v[ií]deo o una publicaci[oó]n)$/i;

  function mark(control) {
    const button = control.querySelector('button, [role="tab"], a');
    const name = control.querySelector(labels)?.textContent || control.textContent;
    const names = [
      name, control.getAttribute('tab-title'), control.getAttribute('title'),
      control.getAttribute('aria-label'), button?.getAttribute('aria-label'), button?.getAttribute('title')
    ];
    control.toggleAttribute('data-stopit-shorts-control', names.some(isShorts));
    if (control.closest(masthead)) {
      const isCreate = control.matches('a, button, [role="button"]') &&
        names.some(value => createLabel.test(value?.trim() || ''));
      control.toggleAttribute('data-stopit-create-control', isCreate);
    }
  }

  // Recheck only inserted controls and owners of changed labels. YouTube
  // both replaces filter bars and reuses existing chips during navigation.
  const observer = new MutationObserver((records) => {
    const changed = new Set();
    for (const record of records) {
      const target = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
      for (let el = target?.closest(controls); el; el = el.parentElement?.closest(controls)) changed.add(el);
      for (const node of record.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.matches(controls)) changed.add(node);
        if (node.firstElementChild) node.querySelectorAll(controls).forEach((el) => changed.add(el));
      }
      if (record.type === 'attributes' && !target.matches(controls)) {
        target.removeAttribute('data-stopit-shorts-control');
        target.removeAttribute('data-stopit-create-control');
      }
    }
    changed.forEach(mark);
  });
  observer.observe(document, {
    subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ['title', 'tab-title', 'aria-label', 'role']
  });
  document.querySelectorAll(controls).forEach(mark);
})();
