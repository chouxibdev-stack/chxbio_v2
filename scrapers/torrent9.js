const { get: fetch } = require('../utils/fetch');
const cheerio = require('cheerio');

const MIRRORS = [
  { url: 'https://www6.torrent9.to', search: sq => `/search_torrent/${sq.replace(/ /g, '-')}.html,trie-seeds-d`, cols: { size: 2, seeders: 3 } },
  { url: 'https://www.torrent9.fo', search: sq => `/search_torrent/${sq.replace(/ /g, '-')}.html,trie-seeds-d`, cols: { size: 2, seeders: 3 } }
];

async function search(query, type, season, episode) {
  const cleanQuery = query.replace(/\s+\d{4}$/, '');
  const searchQueries = buildSearchQueries(cleanQuery, type, season, episode);
  const timeoutMs = parseInt(process.env.TORRENT9_TIMEOUT || '12000', 10);

  return Promise.race([
    firstNonEmpty(MIRRORS.map(mirror => searchMirror(mirror, searchQueries))),
    new Promise(resolve => setTimeout(() => resolve([]), timeoutMs))
  ]);
}

function firstNonEmpty(promises) {
  return new Promise(resolve => {
    let pending = promises.length;
    if (pending === 0) return resolve([]);
    promises.forEach(promise => {
      promise.then(results => {
        if (Array.isArray(results) && results.length > 0) resolve(results);
        else if (--pending === 0) resolve([]);
      }).catch(() => { if (--pending === 0) resolve([]); });
    });
  });
}

async function searchMirror(mirror, searchQueries) {
  const settled = await Promise.allSettled(searchQueries.map(sq => searchMirrorQuery(mirror, sq)));
  const allResults = [];
  for (const s of settled) {
    if (s.status === 'fulfilled' && Array.isArray(s.value)) allResults.push(...s.value);
  }
  if (allResults.length === 0) return [];
  return resolveDetails(mirror, allResults);
}

async function searchMirrorQuery(mirror, searchQuery) {
  try {
    const searchUrl = mirror.url + mirror.search(searchQuery);
    const resp = await fetch(searchUrl, {
      timeout: 10000,
      referer: mirror.url + '/',
      headers: { 'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7' }
    });

    const hasCF = resp.data.includes('challenge-form') || resp.data.includes('cf-browser-verification') || resp.status === 503;
    console.log(`[Torrent9] ${mirror.url} search: ${resp.status} len:${resp.data.length} CF:${hasCF}`);

    const $ = cheerio.load(resp.data);
    const rows = [];
    const $rows = $('table.table-striped > tbody > tr');

    $rows.each((i, row) => {
      try {
        const $row = $(row);
        const link = $row.find('a').first();
        const title = link.attr('title') || link.text().trim();
        const href = link.attr('href') || '';
        if (!title || !href) return;

        rows.push({
          title,
          detailUrl: href.startsWith('http') ? href : mirror.url + href,
          size: $row.find('td').eq(mirror.cols.size).text().trim(),
          seeders: parseInt($row.find('td').eq(mirror.cols.seeders).text().trim()) || 0,
          source: 'torrent9'
        });
      } catch { /* skip */ }
    });

    return rows;
  } catch {
    return [];
  }
}

async function resolveDetails(mirror, rows) {
  const results = [];
  const seen = new Set();
  const uniqueRows = [];

  for (const row of rows) {
    if (seen.has(row.detailUrl)) continue;
    seen.add(row.detailUrl);
    uniqueRows.push(row);
  }

  const batch = uniqueRows
    .sort((a, b) => (b.seeders || 0) - (a.seeders || 0))
    .slice(0, Math.min(uniqueRows.length, 5))
    .map(r => resolveDetail(mirror, r).then(result => {
      if (result) results.push(result);
    }));

  await Promise.allSettled(batch);
  results.sort((a, b) => (b.seeders || 0) - (a.seeders || 0));
  return results;
}

async function resolveDetail(mirror, row) {
  try {
    const detailResp = await fetch(row.detailUrl, {
      timeout: 5000,
      referer: mirror.url + '/'
    });

    const $d = cheerio.load(detailResp.data);
    let infoHash = '';
    $d('a[href^="magnet:"]').each((j, el) => {
      const m = $d(el).attr('href').match(/btih:([a-fA-F0-9]{40})/);
      if (m) { infoHash = m[1].toLowerCase(); return false; }
    });

    if (!infoHash) {
      const h = $d('body').text().match(/([a-fA-F0-9]{40})/);
      if (h) infoHash = h[1].toLowerCase();
    }

    if (!infoHash) return null;

    return {
      title: row.title, size: row.size, seeders: row.seeders, leechers: 0,
      magnet: `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(row.title)}&tr=udp://tracker.opentrackr.org:1337/announce&tr=udp://tracker.torrent.eu.org:451/announce`,
      torrentUrl: '', infoHash, detailUrl: row.detailUrl, uploadDate: '', source: 'torrent9'
    };
  } catch {
    return null;
  }
}

function buildSearchQueries(query, type, season, episode) {
  const queries = [query];
  if (type === 'series' && season) {
    queries.push(`${query} Saison ${season}`);
    queries.push(`${query} S${String(season).padStart(2, '0')}`);
  }
  return [...new Set(queries)];
}

module.exports = { search, name: 'Torrent9', baseUrl: MIRRORS[0].url };
