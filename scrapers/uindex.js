const { get: fetch } = require('../utils/fetch');
const cheerio = require('cheerio');

const BASE_URL = 'https://uindex.org';

const CAT_MAP = { movie: 1, series: 5 };

async function search(query, type, season, episode) {
  const searchQueries = buildSearchQueries(query, type, season, episode);
  const results = [];

  const promises = searchQueries.map(async sq => {
    try {
      const cat = CAT_MAP[type] || 1;
      const url = `${BASE_URL}/search.php?search=${encodeURIComponent(sq)}&c=${cat}&sort=seeders&order=DESC&p=1`;
      const resp = await fetch(url, { timeout: 10000 });
      const $ = cheerio.load(resp.data);

      const rows = [];
      $('table.sr-table > tbody > tr').each((i, row) => {
        try {
          const $row = $(row);
          const link = $row.find('td.sr-col-name a.sr-torrent-link').first();
          const magnetEl = $row.find('td.sr-col-name a.sr-magnet[href^="magnet:"]').first();
          const magnet = magnetEl.attr('href') || '';
          const title = link.attr('title') || link.text().trim();
          if (!title || !magnet) return;

          const m = magnet.match(/btih:([a-fA-F0-9]{40})/i);
          const infoHash = m ? m[1].toLowerCase() : '';

          rows.push({
            title,
            infoHash,
            magnet,
            size: $row.find('td.sr-col-size').text().trim(),
            seeders: parseInt($row.find('td.sr-col-seeders span.sr-seed').text().replace(/,/g, '')) || 0,
            leechers: parseInt($row.find('td.sr-col-leechers span.sr-leech').text().replace(/,/g, '')) || 0,
            source: 'uindex'
          });
        } catch { /* skip */ }
      });
      return rows.filter(r => r.infoHash);
    } catch { return []; }
  });

  const settled = await Promise.allSettled(promises);
  for (const s of settled) {
    if (s.status === 'fulfilled' && s.value.length > 0) results.push(...s.value);
  }

  return results;
}

function buildSearchQueries(query, type, season, episode) {
  const queries = [query];
  if (type === 'series' && season) {
    queries.push(`${query} S${String(season).padStart(2, '0')}`);
    if (episode) queries.push(`${query} S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`);
  }
  return [...new Set(queries)];
}

module.exports = { search, name: 'UIndex', baseUrl: BASE_URL };
