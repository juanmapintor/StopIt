const errorMessage = document.getElementById('error');

for (const input of document.querySelectorAll('[data-preference]')) {
  const key = input.dataset.preference;
  let saved = false;
  StopItPreferences.observe(key, (value) => {
    saved = Boolean(value);
    input.checked = saved;
    input.disabled = false;
  }).catch(() => {
    errorMessage.textContent = chrome.i18n.getMessage('settingsLoadError');
  });

  input.addEventListener('change', async () => {
    errorMessage.textContent = '';
    input.disabled = true;
    try {
      await StopItPreferences.set(key, input.checked);
    } catch {
      input.checked = saved;
      errorMessage.textContent = chrome.i18n.getMessage('settingsSaveError');
    } finally {
      input.disabled = false;
    }
  });
}
