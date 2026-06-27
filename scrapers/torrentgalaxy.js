const { get: fetch } = require('../utils/fetch');
const cheerio = require('cheerio');

const BASE_URL = 'https://torrentgalaxy.one';

async function search(query, type, season, episode) {
  const searchQueries = buildSearchQueries(query, type, season, episode);
  const results = [];

  const promises = searchQueries.map(async sq => {
    try {
      const url = `${BASE_URL}/get-posts/keywords:${encodeURIComponent(sq)}?&sort=seeders`;
      const resp = await fetch(url, { timeout: 10000 });
      const $ = cheerio.load(resp.data);

      const rows = [];
      $('div.tgxtablerow').each((i, row) => {
        try {
          const $row = $(row);
          const link = $row.find('div.clickable-row a[href*="/post-detail/"]').first();
          const title = link.attr('title') || link.text().trim();
          const href = link.attr('href') || '';
          if (!title || !href) return;

          const sizeEl = $row.find('span.badge.badge-secondary').first().text().trim();
          const slEl = $row.find('span[title="Seeders/Leechers"]');
          const seeders = parseInt(slEl.find('font[color="green"]').text().trim()) || 0;
          const leechers = parseInt(slEl.find('font[color="#ff0000"]').text().trim()) || 0;

          rows.push({
            title,
            detailUrl: href.startsWith('http') ? href : BASE_URL + href,
            size: sizeEl,
            seeders,
            leechers,
            source: 'torrentgalaxy'
          });
        } catch { /* skip */ }
      });
      return rows;
    } catch { return []; }
  });

  const settled = await Promise.allSettled(promises);
  for (const s of settled) {
    if (s.status === 'fulfilled' && s.value.length > 0) results.push(...s.value);
  }

  if (results.length === 0) return results;

  const toEnrich = results.sort((a, b) => b.seeders - a.seeders).slice(0, 5);
  const enriched = [];
  for (const r of toEnrich) {
    try {
      const dResp = await fetch(r.detailUrl, { timeout: 7000 });
      const $d = cheerio.load(dResp.data);
      let infoHash = '';

      $d('a[href^="magnet:"]').each((j, el) => {
        const m = $d(el).attr('href').match(/btih:([a-fA-F0-9]{40})/);
        if (m) { infoHash = m[1].toLowerCase(); return false; }
      });

      if (!infoHash) {
        const h = $d('body').text().match(/([a-fA-F0-9]{40})/);
        if (h) infoHash = h[1].toLowerCase();
      }

      if (infoHash) {
        r.infoHash = infoHash;
        enriched.push(r);
      }
    } catch { /* skip */ }
  }

  return enriched;
}

function buildSearchQueries(query, type, season, episode) {
  const queries = [query];
  if (type === 'series' && season) {
    queries.push(`${query} S${String(season).padStart(2, '0')}`);
    if (episode) queries.push(`${query} S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`);
  }
  return [...new Set(queries)];
}

module.exports = { search, name: 'TorrentGalaxy', baseUrl: BASE_URL };
