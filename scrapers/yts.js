const axios = require('axios');

const API_ENDPOINTS = [
  'https://movies-api.accel.li/api/v2',
  'https://yts.mx/api/v2',
  'https://yts.am/api/v2'
];

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0'
];

function getHeaders() {
  return {
    'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
    'Accept': 'application/json'
  };
}

async function search(query, type, season, episode) {
  if (type !== 'movie') return [];

  const results = [];
  const seen = new Set();

  for (const baseUrl of API_ENDPOINTS) {
    if (seen.size > 0) break;
    try {
      const url = `${baseUrl}/list_movies.json?query_term=${encodeURIComponent(query)}&limit=50&sort=seeds&order=desc`;
      const response = await axios.get(url, { headers: getHeaders(), timeout: 15000 });

      if (response.data && response.data.data && response.data.data.movies) {
        for (const movie of response.data.data.movies) {
          if (!movie || !movie.title) continue;
          if (!movie.torrents) continue;

          for (const t of movie.torrents) {
            const magnet = t.url || '';
            let infoHash = (t.hash || '').toLowerCase();
            if (!infoHash && magnet) {
              const m = magnet.match(/btih:([a-fA-F0-9]+)/);
              if (m) infoHash = m[1].toLowerCase();
            }

            const dedupKey = infoHash || `${movie.title}-${t.quality}-${t.type}`;
            if (seen.has(dedupKey)) continue;
            seen.add(dedupKey);

            results.push({
              title: `${movie.title} ${movie.year ? '(' + movie.year + ')' : ''} ${t.quality || ''} ${t.type || ''}`.trim(),
              size: t.size || '',
              seeders: t.seeds || 0,
              leechers: t.peers || 0,
              magnet,
              torrentUrl: t.url || '',
              infoHash,
              detailUrl: movie.url || '',
              uploadDate: movie.date_uploaded || movie.year || '',
              source: 'yts',
              quality: t.quality || '',
              resolution: t.quality ? parseInt(t.quality.replace('p', '')) : null,
              movieTitle: movie.title,
              year: movie.year
            });
          }
        }
      }
    } catch (e) {
      continue;
    }
  }

  return results;
}

module.exports = { search, name: 'YTS', baseUrl: 'https://movies-api.accel.li' };
