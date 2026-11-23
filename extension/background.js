importScripts('routes.js', 'strict-store.js');

const gateURL = chrome.runtime.getURL('check.html');
const cacheLimit = 512;
let updates = Promise.resolve();

function validatedWatch(raw) {
  const url = new URL(raw);
  if (
    url.origin !== 'https://www.youtube.com' ||
    url.username ||
    url.password ||
    url.searchParams.getAll('v').length > 1 ||
    !/^[\w-]{11}$/.test(StopItRoutes.videoId(url) || '')
  )
    throw new Error('Invalid target');
  url.hash = '';
  return url;
}

async function remember(id, kind) {
  const { verified = {} } = await chrome.storage.session.get('verified');
  delete verified[id];
  if (Object.keys(verified).length >= cacheLimit) delete verified[Object.keys(verified)[0]];
  verified[id] = kind;
  await chrome.storage.session.set({ verified });
}

async function permit(url, tabId) {
  // The exact URL is already serialized by URLSearchParams in check.js.
  // This exception cannot authorize another video or another tab.
  const escaped = url.href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ruleId = tabId + 1;
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [ruleId],
    addRules: [
      {
        id: ruleId,
        priority: 10,
        action: { type: 'allow' },
        condition: {
          tabIds: [tabId],
          resourceTypes: ['main_frame'],
          regexFilter: '^' + escaped + '(#.*)?$',
          isUrlFilterCaseSensitive: true
        }
      }
    ]
  });
}

async function handle(message, tabId) {
  const url = validatedWatch(message.url);
  const id = StopItRoutes.videoId(url);
  if (message.action === 'lookup') {
    const { verified = {} } = await chrome.storage.session.get('verified');
    return Object.hasOwn(verified, id) ? verified[id] : null;
  }
  if (message.action !== 'verify' || !['video', 'short'].includes(message.kind))
    throw new Error('Invalid result');
  if (!message.cached) await remember(id, message.kind);
  if (message.kind === 'video') await permit(url, tabId);
  return message.kind;
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!Number.isInteger(sender.tab?.id) || !sender.url) return;
  const strict = message.type === 'strict';
  if (!strict && (sender.frameId !== 0 || sender.url.split(/[?#]/, 1)[0] !== gateURL)) return;
  const task = updates.then(() => strict ? strictRequest(message, sender) : handle(message, sender.tab.id));
  updates = task.catch(() => {});
  task.then(
    (value) => respond({ ok: true, value }),
    () => respond({ ok: false })
  );
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  const task = updates.then(() => Promise.all([
    chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [tabId + 1] }),
    chrome.storage.session.remove('strictHistory:' + tabId)
  ]));
  updates = task.catch(() => {});
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const { strictSince } = await chrome.storage.local.get('strictSince');
  if (!strictSince) return;
  // The tab may still be loading or belong to another site.
  await chrome.tabs.sendMessage(tabId, { type: 'strict-tab-active' }, { frameId: 0 }).catch(() => {});
});
