const StopItPreferences = {
  async observeNotifications(apply) {
    let receivedChange = false;
    chrome.storage.local.onChanged.addListener((changes) => {
      if (!changes.showNotifications) return;
      receivedChange = true;
      apply(changes.showNotifications.newValue === true);
    });
    const { showNotifications } = await chrome.storage.local.get('showNotifications');
    if (!receivedChange) apply(showNotifications === true);
  },

  setNotifications(visible) {
    return chrome.storage.local.set({ showNotifications: visible });
  }
};
