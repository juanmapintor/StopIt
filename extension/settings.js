function bindStopItSettings(root) {
  const errorMessage = root.querySelector('[role="status"]');

  for (const input of root.querySelectorAll('[data-preference]')) {
    const key = input.dataset.preference;
    let saved = false;
    StopItPreferences.observe(key, (value) => {
      saved = Boolean(value);
      input.checked = saved;
      input.disabled = false;
    }).catch(() => {
      errorMessage.textContent = StopItPlatform.message('settingsLoadError');
    });

    input.addEventListener('change', async () => {
      errorMessage.textContent = '';
      input.disabled = true;
      try {
        await StopItPreferences.set(key, input.checked);
      } catch {
        input.checked = saved;
        errorMessage.textContent = StopItPlatform.message('settingsSaveError');
      } finally {
        input.disabled = false;
      }
    });
  }
}
