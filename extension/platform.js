// Browser services used by the feed and settings. The userscript supplies its own implementation.
const StopItPlatform = {
  message: key => chrome.i18n.getMessage(key),
  local: chrome.storage.local,
  onActive(listener) {
    chrome.runtime.onMessage.addListener(message => {
      if (message.type === 'strict-tab-active') listener();
    });
  },
  async strict(message) {
    const result = await chrome.runtime.sendMessage({ type: 'strict', ...message });
    if (!result?.ok) throw new Error('Could not save strict mode state.');
    return result.value;
  },
  navigationFor: host => host.navigation,
  subscriptions: 'https://www.youtube.com/feed/subscriptions'
};
