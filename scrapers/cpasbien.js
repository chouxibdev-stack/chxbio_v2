const { get: fetch } = require('../utils/fetch');
const cheerio = require('cheerio');

const BASE_URL = 'https://www.cpasbien3.cc';

async function search(query, type, season, episode) {
  const results = [];
  const searchQueries = buildSearchQueries(query, type, season, episode);

  for (const sq of searchQueries) {
    try {
      const searchUrl = `${BASE_URL}/recherche/${encodeURIComponent(sq)}`;
      const response = await fetch(searchUrl, {
        timeout: 15000,
        headers: { 'Accept-Language': 'fr-FR,fr;q=0.9' }
      });

      if (!response.data.includes('seed_ok') && !response.data.includes('table-corps')) return [];

      const $ = cheerio.load(response.data);

      $('a.titre').each((i, el) => {
        try {
          const title = $(el).find('div.maxi').text().trim();
          const href = $(el).attr('href') || '';
          if (!title || !href) return;

          const row = $(el).closest('tr');
          const size = row.find('div.poid').text().trim();
          const seeders = parseInt(row.find('span.seed_ok').text().trim()) || 0;
          const leechers = parseInt(row.find('div.down').text().trim()) || 0;

          results.push({
            title,
            size,
            seeders,
            leechers,
            detailUrl: href.startsWith('http') ? href : BASE_URL + href,
            source: 'cpasbien'
          });
        } catch (e) {}
      });

      if (results.length > 0) break;
    } catch (e) {}
  }

  if (results.length === 0) return results;

  const toEnrich = results.sort((a, b) => b.seeders - a.seeders).slice(0, 5);

  const enriched = [];
  for (const r of toEnrich) {
    try {
      const dResp = await fetch(r.detailUrl, {
        timeout: 10000,
        headers: { 'Accept-Language': 'fr-FR,fr;q=0.9' }
      });
      const $d = cheerio.load(dResp.data);
      const dlLink = $d('a[onclick*="/get_torrents/"]').attr('onclick') || $d('a[href*="/get_torrents/"]').attr('href') || '';
      const hashMatch = dlLink.match(/get_torrents\/([a-fA-F0-9]{40})/);
      if (hashMatch) {
        r.infoHash = hashMatch[1].toLowerCase();
        enriched.push(r);
      }
    } catch (e) {}
  }

  return enriched;
}

function buildSearchQueries(query, type, season, episode) {
  const queries = [query];
  if (type === 'series' && season) {
    queries.push(`${query} Saison ${season}`);
    queries.push(`${query} S${String(season).padStart(2, '0')}`);
  }
  return [...new Set(queries)];
}

module.exports = { search, name: 'CPASBien', baseUrl: BASE_URL };
