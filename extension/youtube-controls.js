(() => {
  const notificationMenu = [
    'ytd-multi-page-menu-renderer[menu-style="multi-page-menu-style-type-notifications"]',
    'ytd-popup-container ytd-notification-section-renderer'
  ].join(', ');
  StopItPreferences.observeNotifications((show) => {
    const root = document.documentElement;
    if (!show && root.hasAttribute('data-stopit-show-notifications')) {
      const open = [...document.querySelectorAll(notificationMenu)].some((menu) =>
        menu.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true })
      );
      if (open) {
        // Dismiss the native dropdown before hiding its trigger.
        document.querySelector('ytd-notification-topbar-button-renderer button')?.click();
      }
    }
    root.toggleAttribute('data-stopit-show-notifications', show);
  });

  const controls = [
    'ytd-guide-entry-renderer', 'ytd-mini-guide-entry-renderer', 'ytd-search-filter-renderer',
    'yt-chip-cloud-chip-renderer', '.ytChipBarViewModelChipWrapper', 'chip-view-model', 'yt-chip-view-model',
    'chip-shape', 'yt-tab-shape', 'tp-yt-paper-tab', '[role="tab"]', 'button', '[role="button"]:not(a[href])'
  ].join(', ');
  const labels = '#title, .title, #text, .ytChipShapeText, .ytTabShapeTab, yt-formatted-string';
  const isShorts = (value) => /^(?:YouTube\s+)?Shorts$/i.test(value?.trim() || '');

  function mark(control) {
    const button = control.querySelector('button, [role="tab"], a');
    const name = control.querySelector(labels)?.textContent || control.textContent;
    control.toggleAttribute('data-stopit-shorts-control', [
      name, control.getAttribute('tab-title'), control.getAttribute('title'),
      control.getAttribute('aria-label'), button?.getAttribute('aria-label'), button?.getAttribute('title')
    ].some(isShorts));
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
      if (target?.hasAttribute('data-stopit-shorts-control') && !target.matches(controls)) {
        target.removeAttribute('data-stopit-shorts-control');
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
