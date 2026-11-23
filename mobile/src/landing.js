// Start routing before the settings store or YouTube's DOM is available. A preloaded
// Safari tab can cancel its first navigation and later activate the same document.
const shortRoute = /^\/(?:shorts|feed\/(?:subscriptions\/)?shorts)(?:\/|$)/;
const isLanding = () => location.pathname === '/' || shortRoute.test(location.pathname);
let timer = 0;
let attempts = 0;
function routeLanding() {
  if (!isLanding() || document.prerendering) return;
  if (timer || attempts >= 3) return;
  attempts++;
  timer = setTimeout(() => {
    timer = 0;
    routeLanding();
  }, attempts * 650);
  try { location.replace('/feed/subscriptions'); }
  catch { /* Retry once Safari activates this document. */ }
}
function activate() {
  clearTimeout(timer);
  timer = attempts = 0;
  routeLanding();
}
if (!embeddedPanel) {
  window.addEventListener('pagehide', () => clearTimeout(timer));
  window.addEventListener('pageshow', activate);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) activate(); });
  document.addEventListener('prerenderingchange', activate);
  document.addEventListener('DOMContentLoaded', routeLanding);
  document.addEventListener('yt-navigate-finish', routeLanding);
  window.addEventListener('popstate', activate);
  window.navigation?.addEventListener('currententrychange', activate);
  routeLanding();
}
