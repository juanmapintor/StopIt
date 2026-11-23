// Publication information already rendered by YouTube. Relative labels identify
// an interval (e.g. “hace 2 h” can be between two and three hours old).
const StopItFeedDates = (() => {
  const metadata = '#metadata-line, .media-item-byline, .media-item-byline span, .compact-media-item-byline, .compact-media-item-byline span, ' +
    '.ytm-badge-and-byline-item-byline, .ytmBadgeAndBylineRendererItemByline, .YtmCompactMediaItemStats, ' +
    '.ytContentMetadataViewModelMetadataText, .yt-content-metadata-view-model__metadata-text';
  const metadataRow = '.ytContentMetadataViewModelMetadataRow, .yt-content-metadata-view-model__metadata-row';
  const units = [
    ['seconds?|secs?|s|segundos?|segs?', 1000],
    ['minutes?|mins?|minutos?', 60_000],
    ['hours?|hrs?|h|horas?', 3_600_000],
    ['days?|d|días?', 86_400_000],
    ['weeks?|wks?|semanas?', 7 * 86_400_000],
    ['months?|mos?|mes(?:es)?', 30 * 86_400_000],
    ['years?|yrs?|años?', 365 * 86_400_000]
  ];
  const unit = units.map(([pattern]) => pattern).join('|');
  const quantity = '(\\d+|un|una|an?)';
  const es = new RegExp('\\bhace\\s+' + quantity + '\\s*(' + unit + ')(?![\\p{L}])', 'iu');
  const en = new RegExp('\\b' + quantity + '\\s*(' + unit + ')\\.?\\s+ago\\b', 'iu');
  const duration = units.map(([pattern, ms]) => [new RegExp('^(?:' + pattern + ')$', 'iu'), ms]);

  function absolute(node) {
    if (!node) return null;
    const value = node.getAttribute('datetime') || node.getAttribute('content');
    const earliest = Date.parse(value);
    if (!Number.isFinite(earliest)) return null;
    const latest = /^\d{4}-\d{2}-\d{2}$/.test(value) ? earliest + 86_400_000 - 1 : earliest;
    return { earliest, latest };
  }

  function read(card, live, previous, title) {
    const exact = absolute(card.querySelector(live
      ? '[itemprop="startDate"], time[datetime]:not([itemprop])'
      : '[itemprop="datePublished"], [itemprop="uploadDate"], time[datetime]:not([itemprop])'));
    if (exact) return exact;
    // Remove the user-supplied title from the accessible description before
    // looking for an age. A title can itself contain “hace 10 minutos”.
    const label = (title?.getAttribute('aria-label') || '').replace(title?.textContent.trim() || '', '');
    const fields = card.querySelectorAll(metadata);
    const texts = [...(fields.length ? fields : card.querySelectorAll(metadataRow))]
      .filter(node => !node.querySelector('a'))
      .map(node => node.textContent);
    texts.push(label);
    for (const text of texts) {
      const match = es.exec(text) || en.exec(text);
      if (!match) continue;
      const count = /^\d+$/.test(match[1]) ? Number(match[1]) : 1;
      const ms = duration.find(([pattern]) => pattern.test(match[2]))[1];
      const age = count * ms;
      // Keep a stable estimate while the native card still shows the same age.
      if (previous?.age === age && previous.precision === ms) return previous;
      const latest = Date.now() - age;
      return { latest, earliest: latest - ms, age, precision: ms };
    }
    return null;
  }
  return { read };
})();
