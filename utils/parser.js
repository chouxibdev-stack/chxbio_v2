const parseTorrentTitle = require('parse-torrent-title').parse;

function parseTorrent(title) {
  try {
    const parsed = parseTorrentTitle(title);
    return {
      title: parsed.title || null,
      season: parsed.season || null,
      episode: parsed.episode || null,
      year: parsed.year || null,
      quality: parsed.quality || null,
      resolution: parsed.resolution || null,
      codec: parsed.codec || null,
      audio: parsed.audio || null,
      group: parsed.group || null,
      extended: parsed.extended || false,
      hardcoded: parsed.hardcoded || false,
      proper: parsed.proper || false,
      repack: parsed.repack || false,
      convert: parsed.convert || false,
      widescreen: parsed.widescreen || false,
      website: parsed.website || null,
      language: parsed.language || null,
      region: parsed.region || null,
      container: parsed.container || null,
      source: parsed.source || null,
      is3d: parsed.is3d || false,
      normalizedTitle: normalizeTitle(parsed.title || title)
    };
  } catch {
    return { title: normalizeTitle(title) };
  }
}

function normalizeTitle(title) {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/\s+/g, '');
}

function extractSeasonEpisode(title) {
  const regexes = [
    /S(\d{1,2})[.\s-]*E(\d{1,2})/i,
    /Season\s*(\d{1,2})\s*Episode\s*(\d{1,2})/i,
    /(\d{1,2})x(\d{1,2})/,
    /S(\d{1,2})\s*[-]\s*E(\d{1,2})/i,
    /S(\d{1,2})[.\s](\d{1,2})/i
  ];
  for (const regex of regexes) {
    const match = title.match(regex);
    if (match) {
      return { season: parseInt(match[1]), episode: parseInt(match[2]) };
    }
  }
  return null;
}

function extractSeason(title) {
  const regexes = [
    /S(\d{1,2})\b/i,
    /Season\s*(\d{1,2})/i,
    /Complete\s*S(\d{1,2})/i,
    /(\d{1,2})(?:st|nd|rd|th)\s*Season/i
  ];
  for (const regex of regexes) {
    const match = title.match(regex);
    if (match) return parseInt(match[1]);
  }
  return null;
}

function extractSeasonRange(title) {
  const patterns = [
    /S(\d{1,2})\s*[-–&]\s*S(\d{1,2})/i,
    /S(\d{1,2})\s*(?:to|-)\s*S(\d{1,2})/i,
    /Season\s*(\d{1,2})\s*[-–&]\s*(\d{1,2})/i,
    /Seasons\s*(\d{1,2})\s*[-–&]\s*(\d{1,2})/i,
    /(\d{1,2})\s*[-–&]\s*(\d{1,2})\s*Season/i,
  ];
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      const start = parseInt(match[1]);
      const end = parseInt(match[2]);
      if (start > 0 && end > 0 && end >= start) return { start, end };
    }
  }
  return null;
}

function extractQuality(title) {
  const qualities = {
    '2160p': 2160, '4K': 2160, 'UHD': 2160,
    '1080p': 1080, 'FHD': 1080,
    '720p': 720, 'HD': 720,
    '480p': 480, 'SD': 480, '360p': 360
  };
  for (const [key, val] of Object.entries(qualities)) {
    if (title.toUpperCase().includes(key.toUpperCase())) return val;
  }
  return null;
}

function extractSize(bytes) {
  if (!bytes) return null;
  if (typeof bytes === 'number') return bytes;
  const units = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 };
  const match = bytes.match(/^([\d.]+)\s*(B|KB|MB|GB|TB)$/i);
  if (match) return parseFloat(match[1]) * (units[match[2].toUpperCase()] || 1);
  return null;
}

module.exports = {
  parseTorrent,
  normalizeTitle,
  extractSeasonEpisode,
  extractSeason,
  extractSeasonRange,
  extractQuality,
  extractSize
};
