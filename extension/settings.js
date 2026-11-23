const notifications = document.getElementById('notifications');
const errorMessage = document.getElementById('error');

StopItPreferences.observeNotifications((visible) => {
  notifications.checked = visible;
  notifications.disabled = false;
}).catch(() => {
  errorMessage.textContent = 'No se pudieron cargar los ajustes. Volvé a abrir StopIt.';
});

notifications.addEventListener('change', async () => {
  const visible = notifications.checked;
  errorMessage.textContent = '';
  notifications.disabled = true;
  try {
    await StopItPreferences.setNotifications(visible);
  } catch {
    notifications.checked = !visible;
    errorMessage.textContent = 'No se pudo guardar el cambio. Intentá de nuevo.';
  } finally {
    notifications.disabled = false;
  }
});
