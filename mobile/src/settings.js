(() => {
  const t = StopItPlatform.message;
  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.id = 'stopit-settings-button';
  const icon = document.createElement('img');
  icon.alt = '';
  icon.width = icon.height = 24;
  icon.src = stopItIcon;
  launcher.append(icon);
  launcher.title = t('settingsTitle');
  launcher.lang = t('languageCode');
  launcher.setAttribute('aria-label', t('settingsTitle'));
  launcher.setAttribute('aria-haspopup', 'dialog');

  const dialog = document.createElement('dialog');
  dialog.id = 'stopit-settings';
  dialog.lang = launcher.lang;
  dialog.setAttribute('aria-labelledby', 'stopit-settings-title');
  const title = document.createElement('h2');
  title.id = 'stopit-settings-title';
  title.textContent = t('settingsTitle');
  dialog.append(title);
  for (const [key, name, description] of [
    ['showNotifications', 'showNotifications', 'notificationsDescription'],
    ['showCreateButton', 'showCreateButton', 'createButtonDescription'],
    ['strictSince', 'strictMode', 'strictDescription']
  ]) {
    const label = document.createElement('label');
    const text = document.createElement('span');
    const heading = document.createElement('strong');
    heading.id = 'stopit-label-' + key;
    heading.textContent = t(name);
    const detail = document.createElement('small');
    detail.id = 'stopit-detail-' + key;
    detail.textContent = t(description);
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.disabled = true;
    input.dataset.preference = key;
    input.setAttribute('role', 'switch');
    input.setAttribute('aria-labelledby', heading.id);
    input.setAttribute('aria-describedby', detail.id);
    text.append(heading, detail);
    label.append(text, input);
    dialog.append(label);
  }
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = t('closeSettings');
  close.onclick = () => dialog.close();
  dialog.append(status, close);
  bindStopItSettings(dialog);
  launcher.onclick = () => { if (!dialog.open) dialog.showModal(); };
  dialog.addEventListener('close', () => launcher.focus({ preventScroll: true }));
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  });
  let header;
  function mount() {
    if (!document.body) return;
    if (!dialog.isConnected) document.body.append(dialog);
    if (header?.isConnected && launcher.parentNode === header) return;
    header = document.querySelector('.mobile-topbar-header-content, ytm-mobile-topbar-renderer .mobile-topbar-header, ytd-masthead #end');
    const parent = header || document.body;
    launcher.toggleAttribute('data-floating', !header);
    if (launcher.parentNode !== parent) parent.append(launcher);
  }
  new MutationObserver(mount).observe(document, { childList: true, subtree: true });
  mount();
})();
