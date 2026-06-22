const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

const jar = new CookieJar();
const client = wrapper(axios.create({ jar }));

function makeHeaders(options = {}) {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Referer': options.referer || 'https://www.google.com/',
    'DNT': '1',
    'Connection': 'keep-alive',
    ...(options.headers || {})
  };
}

async function get(url, options = {}) {
  const timeout = options.timeout || 15000;
  const headers = makeHeaders(options);

  try {
    const resp = await client.get(url, {
      headers,
      timeout,
      responseType: options.responseType || 'text',
      maxRedirects: 5,
      validateStatus: status => status < 400
    });
    return resp;
  } catch (err) {
    if (err.response) return err.response;
    throw err;
  }
}

module.exports = { get, client, jar };
