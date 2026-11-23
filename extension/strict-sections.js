// The three buttons share the native list as their viewport. Only the buttons
// change position. YouTube keeps ownership of its cards and continuation.
class StopItSections {
  constructor(grid) {
    this.grid = grid;
    this.host = grid.parentElement;
    this.outerScrollers = [];
    this.buttons = new Map();
    this.offsets = new Map();
    this.chosen = false;
    this.originalAttributes = new Map(['role', 'tabindex', 'aria-labelledby'].map(
      name => [name, grid.getAttribute(name)]
    ));

    for (const [group, label] of Object.entries({ new: 'sectionNew', older: 'sectionOlder', seen: 'sectionWatched' })) {
      const heading = document.createElement('h2');
      heading.lang = chrome.i18n.getMessage('languageCode');
      heading.dataset.stopitHeading = group;
      const button = document.createElement('button');
      button.type = 'button';
      button.id = 'stopit-section-' + group;
      button.textContent = chrome.i18n.getMessage(label);
      button.setAttribute('aria-expanded', 'false');
      if ('ariaControlsElements' in button) button.ariaControlsElements = [grid];
      button.addEventListener('click', () => {
        this.chosen = true;
        this.select(this.active === group ? 'older' : group);
      });
      heading.append(button);
      this.buttons.set(group, button);
    }

    grid.setAttribute('role', 'region');
    grid.tabIndex = 0;
    grid.setAttribute('data-stopit-strict-grid', '');
    this.scheduleMeasure = () => {
      if (this.frame) return;
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.measure();
      });
    };
    this.resize = new ResizeObserver(this.scheduleMeasure);
    // Lock only the subscription document and the scroll boxes that contain
    // the list. In the sidebar this stops at the iframe's own document.
    for (let el = this.host; el; el = el.parentElement) {
      const root = el === document.body || el === document.documentElement;
      if (!root && !['auto', 'scroll', 'hidden'].includes(getComputedStyle(el).overflowY)) continue;
      el.scrollTop = 0;
      el.setAttribute('data-stopit-scroll-lock', '');
      this.outerScrollers.push(el);
      this.resize.observe(el);
    }
    this.host.setAttribute('data-stopit-section-host', '');
    this.resize.observe(this.host);
    this.onWheel = this.routeWheel.bind(this);
    window.addEventListener('wheel', this.onWheel, { capture: true, passive: false });
    window.addEventListener('resize', this.scheduleMeasure);
  }

  update(hasNew) {
    this.buttons.get('new').disabled = !hasNew;
    if (!this.chosen || (this.active === 'new' && !hasNew)) this.select(hasNew ? 'new' : 'older');
    this.scheduleMeasure();
  }

  select(group) {
    if (group === this.active) return;
    const { grid } = this;
    if (this.active) this.offsets.set(this.active, grid.scrollTop);
    this.active = group;
    grid.dataset.stopitOpen = group;
    const focused = document.activeElement;
    const before = [];
    const after = [];
    let aboveList = true;
    for (const [key, button] of this.buttons) {
      const expanded = key === group;
      button.setAttribute('aria-expanded', String(expanded));
      (aboveList ? before : after).push(button.parentElement);
      if (expanded) aboveList = false;
    }
    grid.before(...before);
    grid.after(...after);
    grid.setAttribute('aria-labelledby', this.buttons.get(group).id);
    this.measure();
    grid.scrollTop = this.offsets.get(group) || 0;
    this.reveal?.cancel();
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.reveal = grid.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
    }
    if (focused?.closest('[data-stopit-heading]') && document.activeElement !== focused) {
      focused.focus({ preventScroll: true });
    }
  }

  routeWheel(event) {
    if (!this.active || !event.cancelable || event.ctrlKey || event.metaKey || event.shiftKey ||
        !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    const path = event.composedPath();
    const matches = selector => path.some(node => node instanceof Element && node.matches(selector));
    if (matches('[role="dialog"], [role="menu"], [role="listbox"], tp-yt-iron-dropdown, ytd-popup-container [role="menuitem"]')) return;
    const card = path.includes(this.grid) && matches('[data-stopit-group]');
    const heading = path.includes(this.host) && matches('[data-stopit-heading]');
    if (!card && !heading) {
      // The hover player can live in a portal outside the scrolling grid.
      // Only claim its wheel while it actually overlays this list.
      if (!matches('ytd-video-preview, #video-preview, #inline-preview-player, .html5-video-player, ytd-moving-thumbnail-renderer')) return;
      const rect = this.grid.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX >= rect.right ||
          event.clientY < rect.top || event.clientY >= rect.bottom) return;
    }
    event.preventDefault();
    event.stopPropagation();
    let distance = event.deltaY;
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) distance *= parseFloat(getComputedStyle(this.grid).lineHeight) || 16;
    if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) distance *= this.grid.clientHeight;
    this.grid.scrollBy({ top: distance, behavior: 'instant' });
  }

  measure() {
    if (!this.host.isConnected) return;
    const top = Math.max(0, this.host.getBoundingClientRect().top);
    const size = bottom => Math.max(0, Math.floor(bottom - top)) + 'px';
    // Start at the full viewport so auto-sized ancestors can grow on resize,
    // then respect any smaller native scrollport (e.g. below a fixed header).
    const style = this.host.style;
    style.setProperty('--stopit-section-height', size(innerHeight));
    let bottom = innerHeight;
    for (const el of this.outerScrollers) {
      if (el === this.host || el === document.body || el === document.documentElement) continue;
      bottom = Math.min(bottom, el.getBoundingClientRect().top + el.clientTop + el.clientHeight);
    }
    if (bottom < innerHeight) style.setProperty('--stopit-section-height', size(bottom));
  }

  destroy() {
    cancelAnimationFrame(this.frame);
    this.resize.disconnect();
    window.removeEventListener('resize', this.scheduleMeasure);
    window.removeEventListener('wheel', this.onWheel, true);
    this.reveal?.cancel();
    for (const el of this.outerScrollers) el.removeAttribute('data-stopit-scroll-lock');
    this.host.removeAttribute('data-stopit-section-host');
    this.host.style.removeProperty('--stopit-section-height');
    for (const button of this.buttons.values()) button.parentElement.remove();
    this.grid.scrollTop = 0;
    delete this.grid.dataset.stopitOpen;
    for (const [name, value] of this.originalAttributes) {
      if (value === null) this.grid.removeAttribute(name);
      else this.grid.setAttribute(name, value);
    }
  }
}
