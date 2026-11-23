// GM storage belongs to this script across YouTube hosts. Broadcast only invalidations;
// read the actual values from the manager when another tab or the panel writes.
const StopItPlatform = (() => {
  const listeners = new Set();
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('stopit-settings-v2') : null;
  const documentId = crypto.randomUUID();
  const language = /^es(?:-|$)/i.test(navigator.language) ? 'es' : 'en';
  const preferences = ['strictSince', 'showNotifications', 'showCreateButton'];
  const local = {
    async get(keys) {
      const pairs = await Promise.all([].concat(keys).map(async key => [key, await GM.getValue(key)]));
      return Object.fromEntries(pairs);
    },
    async set(values) {
      const pairs = Object.entries(values);
      await Promise.all(pairs.map(([key, value]) => GM.setValue(key, value)));
      notify(values);
      channel?.postMessage(Object.keys(values));
    },
    onChanged: { addListener: listener => listeners.add(listener) }
  };
  function notify(values) {
    const changes = Object.fromEntries(Object.entries(values).map(([key, newValue]) => [key, { newValue }]));
    for (const listener of listeners) listener(changes);
  }
  // Serialize invalidations so an older asynchronous read cannot overwrite a newer one.
  let reads = Promise.resolve();
  function refresh(keys) {
    reads = reads.then(async () => notify(await local.get(keys))).catch(console.error);
  }
  channel?.addEventListener('message', ({ data }) => {
    if (Array.isArray(data)) refresh(data.filter(key => preferences.includes(key) ||
      (typeof key === 'string' && /^strictSeen:[\w|.-]{1,180}:[\w-]{11}$/.test(key))));
  });
  window.addEventListener('pagehide', event => { if (!event.persisted) channel?.close(); });
  window.addEventListener('pageshow', () => refresh(preferences));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(preferences); });
  // sessionStorage is per tab and shared with its same-origin subscriptions frame.
  const session = {
    get(key) { return { [key]: JSON.parse(window.sessionStorage.getItem('stopit:' + key) || 'null') }; },
    set(values) {
      for (const [key, value] of Object.entries(values)) window.sessionStorage.setItem('stopit:' + key, JSON.stringify(value));
    }
  };
  function navigationFor(host) {
    if (host.navigation?.currentEntry) return host.navigation;
    // Older Safari and Firefox expose session history without Navigation API entry keys.
    const history = host.history;
    let entry = history.state?.stopitEntry;
    if (!entry || entry.url !== host.location.href) {
      entry = { key: crypto.randomUUID(), url: host.location.href };
      history.replaceState({ ...history.state, stopitEntry: entry }, '');
    }
    const keys = JSON.parse(window.sessionStorage.getItem('stopit:entries') || '[]');
    if (!keys.some(item => item.key === entry.key)) {
      keys.push(entry);
      if (keys.length > 128) keys.shift();
      window.sessionStorage.setItem('stopit:entries', JSON.stringify(keys));
    }
    return { currentEntry: { ...entry, index: keys.findIndex(item => item.key === entry.key) }, entries: () => keys };
  }
  return {
    local, navigationFor,
    subscriptions: '/feed/subscriptions',
    message: key => messages[language][key],
    onActive: listener => window.addEventListener('pageshow', listener),
    strict(message) {
      const sender = { url: location.href, frameId: window === top ? 0 : 1, tab: { id: 0 }, documentId };
      return navigator.locks.request('stopit:strict-data', () =>
        strictRequest(message, sender, { local, session }, () => !document.hidden));
    }
  };
})();
