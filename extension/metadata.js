// Extract only metadata. YouTube's document contains scripts, embeds and styles
// that should never be inserted into the extension's verification page.
globalThis.StopItMetadata = (() => {
  function parse(html, id) {
    let canonical;
    let published = false;
    const tags =
      /<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<(link|meta)\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi;
    for (const match of html.matchAll(tags)) {
      if (!match[2]) continue;
      const attributes = {};
      for (const attr of match[0].matchAll(/\s([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
        attributes[attr[1].toLowerCase()] = attr[2] ?? attr[3] ?? attr[4];
      }
      if (attributes.rel === 'canonical') canonical = attributes.href;
      if (attributes.itemprop === 'datePublished' && Number.isFinite(Date.parse(attributes.content))) {
        published = true;
      }
    }
    if (!canonical) throw new Error('Missing canonical URL');
    const url = new URL(canonical, 'https://www.youtube.com');
    if (url.origin !== 'https://www.youtube.com') throw new Error('Unexpected canonical origin');
    if (url.pathname === '/shorts/' + id) return 'short';
    if (url.pathname !== '/watch' || url.searchParams.get('v') !== id || !published) {
      throw new Error('Could not verify the video');
    }
    return 'video';
  }

  async function identify(id) {
    if (!StopItRoutes.validId(id)) throw new Error('Invalid video ID');
    const url = 'https://www.youtube.com/watch?v=' + id;
    for (const credentials of ['omit', 'include']) {
      const response = await fetch(url, { credentials, signal: AbortSignal.timeout(12000) });
      if (!response.ok) {
        if (credentials === 'omit' && [401, 403].includes(response.status)) continue;
        throw new Error('YouTube returned ' + response.status);
      }
      const html = await response.text();
      try {
        return parse(html, id);
      } catch (error) {
        // A private video may only expose its canonical metadata when signed in.
        if (credentials === 'include') throw error;
      }
    }
  }
  return { identify };
})();
