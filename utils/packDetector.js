const { extractSeasonEpisode, extractSeason, extractSeasonRange, normalizeTitle } = require('./parser');

function isSeriesPack(title, parsed) {
  if (!title) return false;

  const titleLower = title.toLowerCase();

  const packKeywords = [
    'complete', 'season', 'pack', 'bundle', 'collection',
    'vol', 'volume', 'disc', 'box set', 'boxset',
    's\\d{1,2}\\s*-\\s*s\\d{1,2}',
    'episodes?\\s*\\d+\\s*-\\s*\\d+',
    'full series', 'entire', 'season pack', 'season complete',
    's\\d{1,2}(-|\\s*to\\s*)s\\d{1,2}',
    'e\\d{1,2}-e\\d{1,2}',
    '\\d{3,4}p.*(?:complete|season|pack)',
    'all episodes', 's\\d{1,2}\\s+complete',
    'saison', 'integrale', 'intégrale', 'série', 'serie',
    'temporada', 'stagione', 'komplet', 'todos',
    'completa', 'completo', 'completas', 'completos',
    's\\d{1,2}\\s*[-–&]\\s*\\d{1,2}'
  ];

  for (const keyword of packKeywords) {
    try {
      const regex = new RegExp(keyword, 'i');
      if (regex.test(titleLower)) return true;
    } catch {
      if (titleLower.includes(keyword)) return true;
    }
  }

  const se = extractSeasonEpisode(title);
  if (parsed && se && parsed.episode && parsed.season) {
    return false;
  }

  const season = extractSeason(title);
  if (season && !se) {
    return true;
  }

  const range = extractSeasonRange(title);
  if (range) {
    return true;
  }

  if (/e\d{1,2}-e\d{1,2}/i.test(title) || /e\d{1,2}\s*&\s*e\d{1,2}/i.test(title)) {
    return true;
  }

  return false;
}

function getEpisodeInPack(packName, parsed) {
  const se = extractSeasonEpisode(packName);
  if (!se || !parsed) return false;

  if (parsed.season === se.season) {
    return true;
  }

  const packSeason = extractSeason(packName);
  if (packSeason && parsed.season === packSeason) {
    return true;
  }

  return true;
}

function packEpisodeCount(title) {
  const titleLower = title.toLowerCase();

  const rangeMatch = titleLower.match(/e(\d{1,3})\s*[-–&]\s*e(\d{1,3})/i);
  if (rangeMatch) {
    return parseInt(rangeMatch[2]) - parseInt(rangeMatch[1]) + 1;
  }

  rangeMatch = titleLower.match(/(\d{1,3})\s*[-–&]\s*(\d{1,3})\s*episodes/i);
  if (rangeMatch) {
    return parseInt(rangeMatch[2]) - parseInt(rangeMatch[1]) + 1;
  }

  if (/\bcomplete\s+season\b/i.test(titleLower)) {
    return 24;
  }
  if (/\bcomplete\s+series\b/i.test(titleLower)) {
    return 100;
  }

  return null;
}

module.exports = { isSeriesPack, getEpisodeInPack, packEpisodeCount };
