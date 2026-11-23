(async () => {
  const { subscriptions, videoId } = StopItRoutes;
  document.getElementById('retry').onclick = () => location.reload();
  try {
    const target =
      !location.search && location.hash.startsWith('#source=')
        ? new URL(location.hash.slice(8))
        : new URL('/watch' + location.search + location.hash, 'https://www.youtube.com');
    if (!['https://www.youtube.com', 'https://m.youtube.com', 'https://youtube.com'].includes(target.origin))
      throw new Error('Invalid site');
    target.hostname = 'www.youtube.com';
    const params = target.searchParams;
    const id = videoId(target);
    if (!StopItMetadata.validId(id)) {
      if (!id && params.get('list')) {
        location.replace('https://www.youtube.com/playlist?list=' + encodeURIComponent(params.get('list')));
        return;
      }
      throw new Error('Invalid ID');
    }
    if (params.has('v')) params.set('v', params.get('v'));
    const url = target.href;
    const ask = async (message) => {
      const reply = await chrome.runtime.sendMessage({ ...message, url });
      if (!reply?.ok) throw new Error('Verification unavailable');
      return reply.value;
    };
    const cached = await ask({ action: 'lookup' });
    let kind = cached;
    if (!kind) {
      try {
        kind = (await StopItMetadata.read(id)).kind;
      } catch {
        kind = (await StopItMetadata.read(id, 'include')).kind;
      }
    }
    await ask({ action: 'verify', kind, cached: Boolean(cached) });
    location.replace(kind === 'short' ? subscriptions : url);
  } catch {
    document.getElementById('status').textContent = 'No se pudo verificar este video';
    const detail = document.getElementById('detail');
    detail.textContent = 'Podés volver a intentarlo o abrir tus suscripciones.';
    detail.hidden = false;
    document.getElementById('actions').hidden = false;
  }
})();
