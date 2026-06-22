const { get: fetch } = require('../utils/fetch');
const cheerio = require('cheerio');

const BASE_URL = 'https://www.cpasbien3.cc';
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
];

function getHeaders() {
  return {
    'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': BASE_URL + '/',
    'DNT': '1',
    'Connection': 'keep-alive'
  };
}

async function search(query, type, season, episode) {
  const results = [];
  const searchQueries = buildSearchQueries(query, type, season, episode);

  for (const sq of searchQueries) {
    try {
      const searchUrl = `${BASE_URL}/recherche/${encodeURIComponent(sq.replace(/\s+/g, '-'))}/`;
      const response = await fetch(searchUrl, {
        timeout: 15000,
        referer: BASE_URL + '/',
        headers: { 'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7' }
      });

      const $ = cheerio.load(response.data);
      $('.ligne, .ligne0, [class*="ligne"], .torrent-item, article').each((i, elem) => {
        try {
          const titleEl = $(elem).find('a');
          let title = '';
          let detailUrl = '';

          titleEl.each((j, a) => {
            const href = $(a).attr('href') || '';
            if (href.includes('/telecharger/') || href.includes('/torrent/') || href.includes('/dl/')) {
              const t = $(a).text().trim() || $(a).attr('title') || '';
              if (t.length > title.length) {
                title = t;
                detailUrl = href;
              }
            }
          });

          if (!title) title = $(elem).text().trim();
          if (!title || title.length < 5) return;

          const spanText = $(elem).text();
          let size = '';
          let seeders = 0;
          let leechers = 0;

          const sizeMatch = spanText.match(/(\d+[.,]?\d*)\s*(Go|Mo|Ko|GB|MB|KB)/i);
          if (sizeMatch) size = sizeMatch[0];

          const seedMatch = spanText.match(/(\d+)\s*seed/i);
          if (seedMatch) seeders = parseInt(seedMatch[1]);

          const leechMatch = spanText.match(/(\d+)\s*leech/i);
          if (leechMatch) leechers = parseInt(leechMatch[1]);

          let magnet = '';
          let infoHash = '';
          const magnetEl = $(elem).find('a[href*="magnet:"]');
          if (magnetEl.length) {
            magnet = magnetEl.attr('href') || '';
            const ih = magnet.match(/btih:([a-fA-F0-9]+)/);
            if (ih) infoHash = ih[1];
          }

          results.push({
            title,
            size,
            seeders,
            leechers,
            magnet,
            torrentUrl: '',
            infoHash,
            detailUrl: detailUrl.startsWith('http') ? detailUrl : BASE_URL + detailUrl,
            uploadDate: '',
            source: 'cpasbien'
          });
        } catch (e) {
          // skip
        }
      });
    } catch (e) {
      // skip
    }
  }

  return results;
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
