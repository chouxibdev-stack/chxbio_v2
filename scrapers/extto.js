const { get: fetch } = require('../utils/fetch');
const cheerio = require('cheerio');

const BASE_URL = 'https://extto.org';

async function search(query, type, season, episode) {
  const searchQueries = buildSearchQueries(query, type, season, episode);
  const results = [];

  for (const sq of searchQueries) {
    try {
      const url = `${BASE_URL}/browse/?q=${encodeURIComponent(sq)}`;
      const resp = await fetch(url, { timeout: 10000 });
      const $ = cheerio.load(resp.data);

      $('table.table.table-striped.table-hover.search-table tr').slice(1).each((i, row) => {
        try {
          const $row = $(row);
          const magnet = $row.find('td').eq(0).find('a[href^="magnet:"]').attr('href') || '';
          const titleEl = $row.find('td').eq(0).find('a[href^="/post-detail/"]').first();
          const title = titleEl.text().trim() || titleEl.find('span.name').text().trim();
          if (!title || !magnet) return;

          const m = magnet.match(/btih:([a-fA-F0-9]{40})/i);
          const infoHash = m ? m[1].toLowerCase() : '';
          if (!infoHash) return;

          results.push({
            title,
            infoHash,
            size: $row.find('td').eq(1).text().trim(),
            seeders: parseInt($row.find('td').eq(4).text().replace(/,/g, '')) || 0,
            leechers: parseInt($row.find('td').eq(5).text().replace(/,/g, '')) || 0,
            source: 'extto'
          });
        } catch {}
      });

      if (results.length > 0) break;
    } catch {}
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

module.exports = { search, name: 'ExtTorrents', baseUrl: BASE_URL };
