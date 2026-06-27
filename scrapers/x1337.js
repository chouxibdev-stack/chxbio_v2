const { get: fetch } = require('../utils/fetch');
const cheerio = require('cheerio');

const BASE_URL = 'https://www.1377x.to';

const CATEGORY_MAP = { movie: 'Movies', series: 'TV', anime: 'Anime' };

async function search(query, type, season, episode) {
  const searchQueries = buildSearchQueries(query, type, season, episode);
  const results = [];

  const promises = searchQueries.map(async sq => {
    try {
      const category = CATEGORY_MAP[type] || 'Movies';
      const url = `${BASE_URL}/category-search/${encodeURIComponent(sq)}/${category}/1/`;
      const resp = await fetch(url, { timeout: 10000 });
      const $ = cheerio.load(resp.data);

      const rows = [];
      $('table.table-list > tbody > tr').each((i, row) => {
        try {
          const $row = $(row);
          const link = $row.find('td.coll-1.name a[href*="/torrent/"]').first();
          const title = link.text().trim();
          const href = link.attr('href') || '';
          if (!title || !href) return;

          rows.push({
            title,
            detailUrl: href.startsWith('http') ? href : BASE_URL + href,
            size: $row.find('td.coll-4.size').text().trim(),
            seeders: parseInt($row.find('td.coll-2.seeds').text().trim()) || 0,
            leechers: parseInt($row.find('td.coll-3.leeches').text().trim()) || 0,
            source: '1337x'
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
        const ih = $d('.infohash-box span').text().trim();
        if (ih) infoHash = ih.toLowerCase();
      }

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

module.exports = { search, name: '1337x', baseUrl: BASE_URL };
