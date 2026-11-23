// Safari reads YouTube's apple-itunes-app metadata to offer the native app.
// Remove it as soon as the parser inserts it, also after a client-side navigation.
(() => {
  const metadata = 'meta:is([name="apple-itunes-app" i], [name="google-play-app" i])';
  const banners = 'ytm-mealbar-promo-renderer, ytm-statement-banner-renderer, ytm-banner-promo-renderer, [data-app-promo]';
  const actions = 'a, button, [role="button"]';
  const appLabel = /^(?:(?:open|use|get|download|install) (?:in )?(?:(?:the|youtube) )?app|(?:abrir|abre|abrí|usar|usa|usá|descargar|descarga|descargá|instalar|instala|instalá) (?:en )?(?:la )?(?:app|aplicaci[oó]n))(?: (?:de )?youtube)?$/i;
  const appLink = /^(?:https?:\/\/(?:apps\.apple\.com\/[^?#]*\/id544007664|play\.google\.com\/store\/apps\/details\?[^#]*\bid=com\.google\.android\.youtube(?:[&#]|$))|(?:vnd\.youtube|youtube|intent):\/\/)/i;
  const inHeader = 'ytm-header, ytm-mobile-topbar-renderer, .mobile-topbar-header';
  function isOffer(el) {
    return appLink.test(el.getAttribute('href') || '') ||
      [el.getAttribute('aria-label'), el.textContent].some(value => appLabel.test(value?.trim() || ''));
  }
  function scan(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.matches(metadata)) { node.remove(); return; }
    node.querySelectorAll(metadata).forEach(meta => meta.remove());
    const owners = new Set(node.querySelectorAll(banners));
    const owner = node.closest(banners);
    if (owner) owners.add(owner);
    for (const banner of owners) {
      banner.toggleAttribute('data-stopit-app-offer', [...banner.querySelectorAll(actions)].some(isOffer));
    }
    const controls = [...node.querySelectorAll('ytm-header :is(a,button,[role="button"]), .mobile-topbar-header :is(a,button,[role="button"])')];
    const control = node.closest(actions);
    if (control?.closest(inHeader)) controls.push(control);
    for (const el of controls) el.toggleAttribute('data-stopit-app-offer', isOffer(el));
  }
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'characterData') {
        const control = record.target.parentElement?.closest(actions);
        if (control?.closest(banners + ', ' + inHeader)) scan(control);
      } else if (record.type === 'attributes') scan(record.target);
      else {
        for (const node of record.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) scan(node);
          else if (node.parentElement?.closest(actions + ', ' + banners)) scan(node.parentElement);
        }
      }
    }
  }).observe(document, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['name', 'href', 'aria-label'] });
  if (document.documentElement) scan(document.documentElement);
})();
