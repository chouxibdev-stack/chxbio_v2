const { get: fetch } = require('../utils/fetch');
const cheerio = require('cheerio');

const BASE_URL = 'https://rargb.to';

async function search(query, type, season, episode) {
  const searchQueries = buildSearchQueries(query, type, season, episode);
  const results = [];

  for (const sq of searchQueries) {
    try {
      const url = `${BASE_URL}/search/?search=${encodeURIComponent(sq)}&order=seeders&by=DESC`;
      const resp = await fetch(url, { timeout: 10000 });
      const $ = cheerio.load(resp.data);

      $('tr.lista2').each((i, row) => {
        try {
          const $row = $(row);
          const tds = $row.find('td');
          if (tds.length < 7) return;
          const titleEl = tds.eq(1).find('a').first();
          const title = titleEl.text().trim();
          const detailPath = titleEl.attr('href') || '';
          if (!title || !detailPath) return;

          results.push({
            title,
            size: tds.eq(4).text().trim(),
            seeders: parseInt(tds.eq(5).text().replace(/,/g, '')) || 0,
            leechers: parseInt(tds.eq(6).text().replace(/,/g, '')) || 0,
            detailUrl: detailPath.startsWith('http') ? detailPath : BASE_URL + detailPath,
            source: 'rargb'
          });
        } catch {}
      });

      if (results.length > 0) break;
    } catch {}
  }

  if (results.length === 0) return results;

  const toEnrich = results.sort((a, b) => b.seeders - a.seeders).slice(0, 10);
  const enriched = [];

  await Promise.allSettled(toEnrich.map(async (r) => {
    try {
      const dResp = await fetch(r.detailUrl, { timeout: 5000 });
      const $d = cheerio.load(dResp.data);
      const magnet = $d('a[href^="magnet:"]').attr('href') || '';
      const m = magnet.match(/btih:([a-fA-F0-9]{40})/i);
      if (m) {
        r.infoHash = m[1].toLowerCase();
        enriched.push(r);
      }
    } catch {}
  }));

  return enriched.sort((a, b) => b.seeders - a.seeders);
}

function buildSearchQueries(query, type, season, episode) {
  const queries = [query];
  if (type === 'series' && season) {
    queries.push(`${query} S${String(season).padStart(2, '0')}`);
    if (episode) queries.push(`${query} S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`);
  }
  return [...new Set(queries)];
}

module.exports = { search, name: 'RARBG', baseUrl: BASE_URL };
