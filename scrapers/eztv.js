const { get: fetch } = require('../utils/fetch');

const MIRRORS = [
  'https://eztv.tf',
  'https://eztv.ag',
  'https://eztv.io',
  'https://eztvx.to',
  'https://eztv.re'
];

async function search(query, type, season, episode) {
  if (type !== 'series') return [];
  const results = [];
  const seen = new Set();

  const searchQueries = buildSearchQueries(query, type, season, episode);
  const queryLower = query.toLowerCase();
  const queryKeywords = queryLower.split(/[^a-z0-9]+/).filter(Boolean);

  for (const sq of searchQueries) {
    if (seen.size > 100) break;
    for (const mirror of MIRRORS) {
      try {
        // API search param is broken on all mirrors, so fetch latest with large limit
        const limit = 100;
        const url = `${mirror}/api/get-torrents?page=1&limit=${limit}`;
        const response = await fetch(url, {
          timeout: 15000,
          referer: mirror + '/'
        });

        if (response.data && Array.isArray(response.data.torrents)) {
          for (const t of response.data.torrents) {
            if (!t || !t.title) continue;
            if (seen.size > 100) break;

            // Client-side matching against the query
            const titleLower = t.title.toLowerCase();
            const matches = queryKeywords.every(kw => titleLower.includes(kw));

            // If season/episode specified, check those too
            let seasonMatch = true;
            let episodeMatch = true;

            if (season && t.season) {
              const tSeason = parseInt(t.season);
              seasonMatch = tSeason === parseInt(season);
            }
            if (seasonMatch && episode && t.episode) {
              const tEpisode = parseInt(t.episode);
              episodeMatch = tEpisode === parseInt(episode);
            }

            if (!matches || !seasonMatch || !episodeMatch) continue;

            let magnet = t.magnet_url || '';
            let infoHash = t.hash || '';

            if (!infoHash && magnet) {
              const match = magnet.match(/btih:([a-fA-F0-9]+)/);
              if (match) infoHash = match[1].toLowerCase();
            }

            const dedupKey = infoHash || t.title;
            if (seen.has(dedupKey)) continue;
            seen.add(dedupKey);

            results.push({
              title: t.title || '',
              size: t.size_bytes ? formatSize(parseInt(t.size_bytes)) : (t.filesize || ''),
              seeders: parseInt(t.seeds) || 0,
              leechers: parseInt(t.peers) || 0,
              magnet,
              torrentUrl: t.torrent_url || '',
              infoHash: infoHash.toLowerCase(),
              detailUrl: t.torrent_url || '',
              uploadDate: t.date_released_unix ? new Date(t.date_released_unix * 1000).toISOString().split('T')[0] : '',
              source: 'eztv'
            });
          }
        }
        if (results.length > 0) break;
      } catch (e) {
        continue;
      }
      if (results.length > 0) break;
    }
  }

  return results;
}

function buildSearchQueries(query, type, season, episode) {
  const queries = [query];
  if (type === 'series' && season) {
    const s = String(season).padStart(2, '0');
    queries.push(`${query} S${s}`);
    if (episode) queries.push(`${query} S${s}E${String(episode).padStart(2, '0')}`);
  }
  return [...new Set(queries)];
}

function formatSize(bytes) {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(2)} ${units[i]}`;
}

module.exports = { search, name: 'EZTV', baseUrl: MIRRORS[0] };
