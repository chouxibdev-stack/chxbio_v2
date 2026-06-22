const { get: fetch } = require('../utils/fetch');
const cheerio = require('cheerio');

const API_MIRRORS = ['https://apibay.org', 'https://tpbapi.org'];
const HTML_MIRRORS = ['https://tpb.party', 'https://thepiratebay.org', 'https://pirateproxy.live'];

async function search(query, type, season, episode) {
  const searchQueries = buildSearchQueries(query, type, season, episode);

  // Race all queries on API mirrors in parallel
  const apiAttempts = searchQueries.flatMap(sq =>
    API_MIRRORS.map(apiUrl => searchApi(apiUrl, sq))
  );
  const apiResult = await firstNonEmpty(apiAttempts);
  if (apiResult.length > 0) return apiResult;

  // Fallback: race all queries on HTML mirrors in parallel
  const htmlAttempts = searchQueries.flatMap(sq =>
    HTML_MIRRORS.map(mirror => searchHtml(mirror, sq))
  );
  return await firstNonEmpty(htmlAttempts);
}

async function searchApi(apiUrl, sq) {
  try {
    const { data } = await fetch(`${apiUrl}/q.php?q=${encodeURIComponent(sq)}&cat=0`, {
      timeout: 10000,
      headers: { 'Accept': 'application/json' }
    });
    if (!Array.isArray(data)) return [];
    return data
      .filter(item => item && item.name && item.name !== 'No results' && item.info_hash)
      .map(item => ({
        title: item.name,
        size: item.size ? formatSize(parseInt(item.size)) : '',
        seeders: parseInt(item.seeders) || 0,
        leechers: parseInt(item.leechers) || 0,
        magnet: `magnet:?xt=urn:btih:${item.info_hash.toLowerCase()}&dn=${encodeURIComponent(item.name)}&tr=udp://tracker.opentrackr.org:1337/announce&tr=udp://tracker.torrent.eu.org:451/announce`,
        torrentUrl: '',
        infoHash: item.info_hash.toLowerCase(),
        detailUrl: `${apiUrl}/torrent/${item.id}`,
        uploadDate: '',
        source: 'piratebay'
      }));
  } catch { return []; }
}

async function searchHtml(mirror, sq) {
  try {
    const resp = await fetch(`${mirror}/search/${encodeURIComponent(sq)}/1/99/0`, {
      timeout: 15000,
      referer: mirror + '/'
    });
    const $ = cheerio.load(resp.data);
    if ($('#searchResult').length === 0) return [];

    const results = [];
    $('#searchResult tr').each((i, row) => {
      if (i === 0 || $(row).hasClass('header')) return;
      try {
        const $row = $(row);
        const $tds = $row.find('td');

        const titleLink = $tds.eq(1).find('a').first();
        let title = titleLink.text().trim() || titleLink.attr('title') || '';
        if (!title) return;

        const detailPath = titleLink.attr('href') || '';
        const detailUrl = detailPath.startsWith('http') ? detailPath : mirror + detailPath;

        const magnetEl = $tds.eq(3).find('a[href*="magnet:"]');
        const magnet = magnetEl.attr('href') || '';

        let infoHash = '';
        if (magnet) {
          const m = magnet.match(/btih:([a-fA-F0-9]{40})/);
          if (m) infoHash = m[1].toLowerCase();
        }
        if (!infoHash) return;

        const size = $tds.eq(4).text().trim();
        const seeders = parseInt($tds.eq(5).text().trim()) || 0;
        const leechers = parseInt($tds.eq(6).text().trim()) || 0;

        results.push({
          title, size, seeders, leechers,
          magnet: `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(title)}&tr=udp://tracker.opentrackr.org:1337/announce&tr=udp://tracker.torrent.eu.org:451/announce`,
          torrentUrl: '', infoHash, detailUrl,
          uploadDate: $tds.eq(2).text().trim(),
          source: 'piratebay'
        });
      } catch { /* skip */ }
    });

    return results;
  } catch { return []; }
}

function firstNonEmpty(promises) {
  return new Promise(resolve => {
    let pending = promises.length;
    if (pending === 0) return resolve([]);
    promises.forEach(p => {
      p.then(r => { if (r.length > 0) resolve(r); else if (--pending === 0) resolve([]); })
       .catch(() => { if (--pending === 0) resolve([]); });
    });
  });
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

function formatSize(sizeNum) {
  if (!sizeNum) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let size = sizeNum;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(2)} ${units[i]}`;
}

module.exports = { search, name: 'PirateBay', baseUrl: 'https://apibay.org' };
