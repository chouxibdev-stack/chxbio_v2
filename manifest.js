const manifest = {
  id: 'community.chxbio',
  version: '1.0.1',
  name: 'CHXBIO',
  description: 'Torrent scraper addon - BitSearch, LimeTorrents, CPASBien, Torrent9, Nyaa.si & more. Supports Real-Debrid, AllDebrid, Premiumize.',
  logo: 'https://i.imgur.com/4g4L4vF.png',
  background: 'https://i.imgur.com/4g4L4vF.png',
  resources: ['stream', 'catalog', 'meta'],
  types: ['movie', 'series'],
  idPrefixes: ['tt', 'kitsu', 'mal'],
  catalogs: [
    {
      type: 'movie',
      id: 'chxbio_popular_movies',
      name: 'CHXBIO Popular Movies',
      extra: [{ name: 'search', isRequired: false }]
    },
    {
      type: 'series',
      id: 'chxbio_popular_series',
      name: 'CHXBIO Popular Series',
      extra: [{ name: 'search', isRequired: false }]
    }
  ]
};

module.exports = { manifest };
