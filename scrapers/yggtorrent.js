const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://www2.yggtorrent.se';
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0'
];

function getHeaders() {
  return {
    'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': BASE_URL + '/',
    'DNT': '1'
  };
}

async function search(query, type, season, episode) {
  const results = [];
  const searchQueries = buildSearchQueries(query, type, season, episode);

  for (const sq of searchQueries) {
    try {
      const url = `${BASE_URL}/engine/search?name=${encodeURIComponent(sq)}&do=search&page=1&order=seed&sort=desc`;
      const response = await axios.get(url, {
        headers: getHeaders(),
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      $('.table tr, .results tr').each((i, elem) => {
        try {
          const cells = $(elem).find('td');
          if (cells.length < 5) return;

          const titleEl = $(cells[1]).find('a').first();
          let title = titleEl.text().trim();
          if (!title) return;

          const detailUrl = titleEl.attr('href') || '';

          let size = '';
          let seeders = 0;
          let leechers = 0;
          let completed = 0;

          if (cells.length >= 4) {
            size = $(cells[2]).text().trim() || '';
            const dl = $(cells[3]).text().trim().match(/up:?\s*(\d+)|(\d+)/i);
            const up = $(cells[4]).text().trim().match(/down:?\s*(\d+)|(\d+)/i);
            if (cells.length >= 5) {
              seeders = parseInt($(cells[3]).text().trim()) || 0;
              leechers = parseInt($(cells[4]).text().trim()) || 0;
            }
          }

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
            source: 'yggtorrent'
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
    queries.push(`${query} Saisons`);
    queries.push(`${query} S${String(season).padStart(2, '0')}`);
  }
  return [...new Set(queries)];
}

module.exports = { search, name: 'YggTorrent', baseUrl: BASE_URL };
