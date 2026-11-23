// This script runs only on StopIt's own HTML pages.
document.documentElement.lang = chrome.i18n.getMessage('languageCode');
for (const element of document.querySelectorAll('[data-i18n]')) {
  element.textContent = chrome.i18n.getMessage(element.dataset.i18n);
}
