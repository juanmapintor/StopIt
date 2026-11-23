// Extract only metadata. YouTube's document contains scripts, embeds and styles
// that should never be inserted into the feed or the extension's verification page.
globalThis.StopItMetadata = (() => {
  const validId = (id) => typeof id === 'string' && /^[\w-]{11}$/.test(id);
  function parse(html, id) {
    let canonical;
    const dates = {};
    const tags =
      /<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<(link|meta)\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi;
    for (const match of html.matchAll(tags)) {
      if (!match[2]) continue;
      const attributes = {};
      for (const attr of match[0].matchAll(/\s([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
        attributes[attr[1].toLowerCase()] = attr[2] ?? attr[3] ?? attr[4];
      }
      if (attributes.rel === 'canonical') canonical = attributes.href;
      if (['datePublished', 'startDate', 'endDate'].includes(attributes.itemprop)) {
        const value = Date.parse(attributes.content);
        if (Number.isFinite(value)) dates[attributes.itemprop] = value;
      }
    }
    if (!canonical) throw new Error('Missing canonical URL');
    const url = new URL(canonical, 'https://www.youtube.com');
    if (url.origin !== 'https://www.youtube.com') throw new Error('Unexpected canonical origin');
    if (url.pathname === '/shorts/' + id) return { kind: 'short' };
    if (url.pathname !== '/watch' || url.searchParams.get('v') !== id || dates.datePublished === undefined) {
      throw new Error('Could not verify the video');
    }
    let liveNow = false;
    let upcoming = false;
    if (dates.startDate && !dates.endDate) {
      const playerJSON = html.match(/\bytInitialPlayerResponse\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script\s*>/i);
      if (playerJSON) {
        try {
          const player = JSON.parse(playerJSON[1]);
          liveNow =
            player.microformat?.playerMicroformatRenderer?.liveBroadcastDetails?.isLiveNow === true ||
            player.videoDetails?.isLive === true;
          upcoming =
            player.videoDetails?.isUpcoming === true ||
            player.playabilityStatus?.status === 'LIVE_STREAM_OFFLINE';
        } catch {
          /* Some layouts only expose the native thumbnail badge. */
        }
      }
    }
    return {
      kind: 'video',
      published: dates.datePublished,
      start: dates.startDate ?? null,
      end: dates.endDate ?? null,
      liveNow,
      upcoming
    };
  }

  async function read(id, credentials = 'omit') {
    if (!validId(id)) throw new Error('Invalid video ID');
    const response = await fetch('https://www.youtube.com/watch?v=' + id, {
      credentials,
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) throw new Error('YouTube returned ' + response.status);
    return parse(await response.text(), id);
  }
  return { read, validId };
})();
