const { get: fetch } = require('../utils/fetch');
const cheerio = require('cheerio');

// Mirrors with class-based layout (.tt-name, .tdseed, .table2)
// Mirror format: { url, searchPath(category, query) }
const MIRRORS = [
  { url: 'https://www.limetorrents.asia', search: (cat, q) => `/search?q=${encodeURIComponent(q)}`, classLayout: false },
  { url: 'https://www.limetorrents.fun', search: (cat, q) => `/search/${cat}/${encodeURIComponent(q)}/seeds/1/`, classLayout: true },
  { url: 'https://www.limetorrents.online', search: (cat, q) => `/search/${cat}/${encodeURIComponent(q)}/seeds/1/`, classLayout: true },
  { url: 'https://www.limetor.info', search: (cat, q) => `/search/${cat}/${encodeURIComponent(q)}/seeds/1/`, classLayout: true },
  { url: 'https://www.limetorrents.pro', search: (cat, q) => `/search/${cat}/${encodeURIComponent(q)}/seeds/1/`, classLayout: true }
];

async function search(query, type, season, episode) {
  const searchQueries = buildSearchQueries(query, type, season, episode);
  const path = type === 'series' ? 'tv' : 'movies';

  // Launch all mirrors in parallel, tag with index
  const tagged = MIRRORS.map((mirror, i) =>
    searchMirror(mirror, path, searchQueries)
      .then(results => ({ i, results }))
      .catch(() => ({ i, results: [] }))
  );

  // Process mirrors as they complete — enrich the first one that returns search results.
  // If enrichment produces nothing (detail pages timed out / no hashes), fall through
  // to the next mirror. This avoids waiting for all mirrors to finish before enriching.
  const done = new Set();
  while (done.size < tagged.length) {
    const remaining = tagged.filter((_, i) => !done.has(i));
    if (remaining.length === 0) break;
    const { i, results } = await Promise.race(remaining);
    done.add(i);
    if (results.length === 0) continue;
    const enriched = await enrichResults(results);
    if (enriched.length > 0) return enriched;
  }
  return [];
}

async function enrichResults(results) {
  const enriched = [];
  // Sort by seeders descending so highest-seeded candidates are enriched first
  const sorted = [...results].sort((a, b) => b.seeders - a.seeders);
  const detailDeadline = Date.now() + 20000;
  const batch = sorted.slice(0, Math.min(sorted.length, 100)).map(async (r, i) => {
    if (Date.now() > detailDeadline) return;
    if (i > 0) await new Promise(r => setTimeout(r, 300));
    if (Date.now() > detailDeadline) return;
    try {
      const detailResp = await fetch(r.detailUrl, {
        timeout: 3000,
        referer: r._mirrorUrl + '/'
      });
      const $d = cheerio.load(detailResp.data);
      let infoHash = '';
      const magnet = $d('a[href^="magnet:"]').attr('href') || '';
      if (magnet) {
        const m = magnet.match(/btih:([a-fA-F0-9]{40})/);
        if (m) infoHash = m[1].toLowerCase();
      }
      if (!infoHash) {
        const h = $d('body').text().match(/([a-fA-F0-9]{40})/);
        if (h) infoHash = h[1].toLowerCase();
      }
      if (infoHash) {
        enriched.push({
          title: r.title, size: r.size, seeders: r.seeders, leechers: r.leechers,
          magnet: `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(r.title)}&tr=udp://tracker.opentrackr.org:1337/announce&tr=udp://tracker.torrent.eu.org:451/announce&tr=udp://open.stealth.si:80/announce&tr=udp://tracker.dler.org:6969/announce`,
          infoHash, torrentUrl: '', detailUrl: r.detailUrl, uploadDate: '', source: 'limetorrents'
        });
      }
    } catch { /* skip */ }
  });
  await Promise.allSettled(batch);
  return enriched.sort((a, b) => b.seeders - a.seeders);
}

async function searchMirror(mirror, path, searchQueries) {
  const attempts = searchQueries.map(async sq => {
    try {
      const searchUrl = mirror.url + mirror.search(path, sq);
      const resp = await fetch(searchUrl, {
        timeout: 5000,
        referer: mirror.url + '/'
      });
      const $ = cheerio.load(resp.data);
      const results = [];

      if (mirror.classLayout) {
        $('table.table2 tr').each((i, row) => {
          if (i === 0) return;
          try {
            const $row = $(row);
            const $nameDiv = $row.find('.tt-name');
            const title = $nameDiv.text().trim();
            const detailPath = $nameDiv.find('a').eq(1).attr('href');
            if (!title || !detailPath) return;
            results.push({
              title, size: $row.find('td').eq(2).text().trim(),
              seeders: parseInt($row.find('.tdseed').text().trim().replace(/,/g, '')) || 0,
              leechers: parseInt($row.find('.tdleech').text().trim().replace(/,/g, '')) || 0,
              detailUrl: detailPath.startsWith('http') ? detailPath : mirror.url + detailPath,
              _mirrorUrl: mirror.url, source: 'limetorrents'
            });
          } catch { /* skip */ }
        });
      } else {
        $('table tr').each((i, row) => {
          if (i === 0) return;
          try {
            const $row = $(row);
            const tds = $row.find('td');
            if (tds.length < 5) return;
            const $link = $row.find('td').eq(0).find('a');
            const title = $link.text().trim();
            const detailPath = $link.attr('href');
            if (!title || !detailPath) return;
            results.push({
              title, size: $row.find('td').eq(2).text().trim(),
              seeders: parseInt($row.find('td').eq(3).text().trim().replace(/,/g, '')) || 0,
              leechers: parseInt($row.find('td').eq(4).text().trim().replace(/,/g, '')) || 0,
              detailUrl: detailPath.startsWith('http') ? detailPath : mirror.url + detailPath,
              _mirrorUrl: mirror.url, source: 'limetorrents'
            });
          } catch { /* skip */ }
        });
      }

      return results;
    } catch { return []; }
  });

  const settled = await Promise.allSettled(attempts);
  const allRows = [];
  for (const s of settled) {
    if (s.status === 'fulfilled' && s.value.length > 0) allRows.push(...s.value);
  }
  return allRows;
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
    queries.push(`${query} S${String(season).padStart(2, '0')}`);
    if (episode) queries.push(`${query} S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`);
  }
  return [...new Set(queries)];
}

module.exports = { search, name: 'LimeTorrents', baseUrl: MIRRORS[0].url };
