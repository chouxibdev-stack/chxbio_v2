const store = new Map();

const DEFAULTS = {
  streamsTTL: parseInt(process.env.STREAMS_TTL || '60000', 10),
  metadataTTL: 24 * 60 * 60 * 1000,
  imdbTTL: 7 * 24 * 60 * 60 * 1000,
};

function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

function set(key, value, ttl) {
  store.set(key, { value, expires: Date.now() + ttl });
}

function makeStreamKey(type, id, season, episode) {
  return `stream:${type}:${id}:${season || ''}:${episode || ''}`;
}

function wrap(fn, key, ttl, options = {}) {
  const cached = get(key);
  if (cached) return cached;
  return fn().then(result => {
    if (!options.shouldCache || options.shouldCache(result)) {
      set(key, result, ttl);
    }
    return result;
  });
}

module.exports = { get, set, makeStreamKey, wrap, DEFAULTS };
