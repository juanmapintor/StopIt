const StopItPreferences = {
  async observe(key, apply) {
    let receivedChange = false;
    chrome.storage.local.onChanged.addListener((changes) => {
      if (!Object.hasOwn(changes, key)) return;
      receivedChange = true;
      apply(changes[key].newValue);
    });
    const stored = await chrome.storage.local.get(key);
    if (!receivedChange) apply(stored[key]);
  },

  set(key, enabled) {
    // The activation time is also the first cutoff for a newly enabled strict feed.
    const value = key === 'strictSince' ? (enabled ? Date.now() : 0) : enabled;
    return chrome.storage.local.set({ [key]: value });
  }
};
