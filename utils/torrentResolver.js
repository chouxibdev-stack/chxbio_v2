const { decode, getFiles } = require('./bencode');

function matchEpisodeInFiles(files, season, episode) {
  const epStr = String(episode).padStart(2, '0');
  const seasonStr = String(season).padStart(2, '0');
  const epShort = String(episode);

  for (const file of files) {
    const name = file.path.toLowerCase().replace(/[/\\]/g, '/');
    const basename = name.split('/').pop() || name;

    const patterns = [
      new RegExp(`s${seasonStr}e${epStr}`, 'i'),
      new RegExp(`s${seasonStr}\\.e${epStr}`, 'i'),
      new RegExp(`season[.\\s]*${season}[.\\s]*episode[.\\s]*${episode}`, 'i'),
      new RegExp(`[\\/]e${epStr}(?:\\.[a-z0-9]+)?$`, 'i'),
      new RegExp(`${season}x${episode}`, 'i'),
      new RegExp(`e${episode}(?:\\.|$)`, 'i'),
      new RegExp(`(?:^|[^0-9])${season}${epStr}(?:[^0-9]|$)`, 'i'),
      new RegExp(`[\\/]${epStr}[.\\s].+\\.[a-z0-9]+$`, 'i'),
    ];

    for (const pattern of patterns) {
      if (pattern.test(name)) return file.index;
    }
  }

  return null;
}

async function resolveFileIndex(infoHash, torrentUrl, season, episode) {
  const urls = [];

  if (torrentUrl) {
    urls.push(torrentUrl);
  }

  const cacheHosts = [
    `https://itorrents.org/torrent/${infoHash.toUpperCase()}.torrent`,
    `https://btcache.me/torrent/${infoHash}.torrent`,
    `https://torrage.com/torrent/${infoHash}.torrent`,
    `https://zoink.it/torrent/${infoHash}.torrent`,
    `https://itorrents.org/torrent/${infoHash.toLowerCase()}.torrent`,
    `https://torrage.info/torrent/${infoHash}.torrent`,
  ];
  urls.push(...cacheHosts);

  for (const url of urls) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!resp.ok) continue;
      const buf = Buffer.from(await resp.arrayBuffer());
      const torrent = decode(buf);
      const files = getFiles(torrent);
      if (files.length === 0) continue;

      const idx = matchEpisodeInFiles(files, season, episode);
      if (idx !== null) return { fileIdx: idx, files, source: url };
    } catch {
      continue;
    }
  }

  return null;
}

module.exports = { resolveFileIndex, matchEpisodeInFiles };
