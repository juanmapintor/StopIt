globalThis.StopItRoutes = (() => {
  const subscriptions = 'https://www.youtube.com/feed/subscriptions';
  function videoId(url) {
    if (url.pathname === '/watch' || url.pathname === '/watch/') return url.searchParams.get('v');
    const match = url.pathname.match(/^\/(?:live|embed|v)\/([\w-]{11})\/?$/);
    if (!match || ['videoseries', 'live_stream'].includes(match[1])) return null;
    return match[1];
  }
  const validId = (id) => typeof id === 'string' && /^[\w-]{11}$/.test(id);
  return { subscriptions, videoId, validId };
})();
