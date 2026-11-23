// Callers serialize visit commits across tabs using the worker queue or a Web Lock.
async function strictRequest(message, sender, storage, tabActive) {
  const { account, since, action } = message;
  if (typeof account !== 'string' || !/^[\w|.-]{1,180}$/.test(account) || !Number.isSafeInteger(since) || since <= 0) return null;
  const url = new URL(sender.url);
  if (!['https://www.youtube.com', 'https://youtube.com', 'https://m.youtube.com'].includes(url.origin)) return null;
  const visitKey = 'strictVisit:' + account;
  const stored = await storage.local.get(['strictSince', visitKey]);
  if (stored.strictSince !== since) return null;

  if (action === 'opened') {
    const id = StopItRoutes.videoId(url);
    if (sender.frameId !== 0 || id !== message.id || !/^[\w-]{11}$/.test(id)) return null;
    if (!(await tabActive())) return null;
    await storage.local.set({ ['strictSeen:' + account + ':' + id]: true });
    return true;
  }
  if (url.pathname.replace(/\/$/, '') !== '/feed/subscriptions') return null;
  if (action === 'progress') {
    const seen = {};
    for (const id of message.ids) {
      if (/^[\w-]{11}$/.test(id)) seen['strictSeen:' + account + ':' + id] = true;
    }
    await storage.local.set(seen);
    return true;
  }
  if (action !== 'visit' && action !== 'preview') return null;
  const { entry, source, historyKeys } = message;
  if (typeof entry !== 'string' || !Array.isArray(historyKeys) || !historyKeys.includes(entry)) return null;
  const historyKey = 'strictHistory:' + sender.tab.id;
  const history = (await storage.session.get(historyKey))[historyKey] || {};
  const embedded = sender.frameId !== 0;
  const matches = (snapshot) => snapshot?.account === account && snapshot.since === since;
  let saved = history[entry];
  if (!matches(saved) || !(embedded || message.restore || saved.documentId === sender.documentId)) saved = null;
  if (!saved && embedded && source && matches(history[source])) saved = history[source];

  const previous = stored[visitKey];
  const now = Date.now();
  let cutoff = since;
  let anchors = [];
  if (previous?.since === since) {
    const quickReturn = now - previous.lastVisit < 5 * 60_000;
    cutoff = quickReturn ? previous.cutoff : previous.lastVisit;
    anchors = (quickReturn ? previous.anchors : previous.head) || [];
  }
  if (saved) {
    cutoff = saved.cutoff;
    anchors = saved.anchors || [];
  }
  let pinned = Boolean(saved) || embedded;
  if (!pinned && action === 'visit' && cutoff === message.cutoff && await tabActive()) {
    // A few leading IDs survive deleted/private uploads and resolve rounded
    // “N hours ago” labels at the next visit. No full impression log is needed.
    const head = Array.isArray(message.head) ? message.head.slice(0, 12).filter(StopItRoutes.validId) : [];
    await storage.local.set({ [visitKey]: { since, cutoff, anchors, head, lastVisit: now } });
    pinned = true;
  }
  if (pinned && (!saved || saved !== history[entry])) {
    for (const old of Object.keys(history)) {
      if (!historyKeys.includes(old)) delete history[old];
    }
    history[entry] = { account, since, cutoff, anchors, documentId: sender.documentId };
    await storage.session.set({ [historyKey]: history });
  }
  return { entry, cutoff, anchors, pinned };
}
