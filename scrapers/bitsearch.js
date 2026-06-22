const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://bitsearch.eu';
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
];

function getHeaders() {
  return {
    'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5,fr;q=0.3',
    'Referer': BASE_URL + '/',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
  };
}

async function search(query, type, season, episode) {
  const searchQueries = buildSearchQueries(query, type, season, episode);

  const results = [];
  const promises = searchQueries.map(async sq => {
    try {
      const url = `${BASE_URL}/search?q=${encodeURIComponent(sq)}&page=1&sort=seeders`;
      const response = await axios.get(url, {
        headers: getHeaders(),
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      const pageResults = [];

      $('.space-y-4 > div.bg-white').each((i, elem) => {
        try {
          const $card = $(elem);
          const $titleLink = $card.find('h3 a').first();
          const title = $titleLink.text().trim();
          if (!title) return;

          const detailPath = $titleLink.attr('href') || '';
          const detailUrl = detailPath.startsWith('http') ? detailPath : BASE_URL + detailPath;
          const magnetLink = $card.find('a[href*="magnet:"]').attr('href') || '';
          const torrentLink = $card.find('a[href*="/download/torrent/"]').attr('href') || '';

          let infoHash = '';
          if (magnetLink) {
            const match = magnetLink.match(/btih:([a-fA-F0-9]+)/);
            if (match) infoHash = match[1];
          }

          const seeders = parseInt($card.find('.text-green-600 .font-medium').first().text().trim()) || 0;
          const leechers = parseInt($card.find('.text-red-600 .font-medium').first().text().trim()) || 0;

          const $statsRow = $card.find('.flex-wrap.items-center.gap-4.text-sm.text-gray-600').first();
          const $statSpans = $statsRow.children('span');
          let size = '', uploadDate = '', category = '';

          $statSpans.each((si, span) => {
            const $span = $(span);
            const icon = $span.find('i').first();
            if (icon.length === 0) return;
            const iconClass = icon.attr('class') || '';
            const text = $span.find('span').first().text().trim();
            if (iconClass.includes('fa-download')) size = text;
            else if (iconClass.includes('fa-calendar')) uploadDate = text;
            else if (iconClass.includes('fa-file') || iconClass.includes('fa-video') || iconClass.includes('fa-music') || iconClass.includes('fa-gamepad') || iconClass.includes('fa-book')) category = text;
          });

          pageResults.push({ title, size, seeders, leechers, magnet: magnetLink, torrentUrl: torrentLink.startsWith('http') ? torrentLink : (torrentLink ? BASE_URL + torrentLink : ''), infoHash, detailUrl, uploadDate, category, source: 'bitsearch' });
        } catch { /* skip */ }
      });

      return pageResults;
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
    const seasonStr = `S${String(season).padStart(2, '0')}`;
    queries.push(`${query} ${seasonStr}`);

    if (episode) {
      const epStr = `E${String(episode).padStart(2, '0')}`;
      queries.push(`${query} ${seasonStr}${epStr}`);
    }
  }

  queries.push(query);
  return [...new Set(queries)];
}

module.exports = { search, name: 'BitSearch', baseUrl: BASE_URL };
