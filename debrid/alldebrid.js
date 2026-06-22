const axios = require('axios');

const API_BASE = 'https://api.alldebrid.com/v4';

class AllDebridClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.agent = 'chxbio';
  }

  async resolveMagnet(magnet) {
    try {
      const params = {
        agent: this.agent,
        apikey: this.apiKey,
        magnets: magnet
      };

      const response = await axios.get(`${API_BASE}/magnet/upload`, {
        params,
        timeout: 30000
      });

      if (response.data && response.data.status === 'success' && response.data.data && response.data.data.magnets && response.data.data.magnets.length > 0) {
        const magnetData = response.data.data.magnets[0];
        const magnetId = magnetData.id || magnetData.magnet;

        if (!magnetId) return null;

        const statusParams = {
          agent: this.agent,
          apikey: this.apiKey,
          id: magnetId
        };

        let ready = false;
        let attempts = 0;

        while (!ready && attempts < 15) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const statusResp = await axios.get(`${API_BASE}/magnet/status`, {
            params: statusParams,
            timeout: 15000
          });

          if (statusResp.data && statusResp.data.status === 'success') {
            const data = statusResp.data.data;
            if (data.ready) {
              ready = true;
              if (data.links && data.links.length > 0) {
                const videoLinks = data.links.filter(l =>
                  /\.(mp4|mkv|avi|mov|wmv|flv|webm)$/i.test(l.filename || l.link || '')
                );

                if (videoLinks.length === 0) return null;

                if (videoLinks.length === 1) {
                  return {
                    url: videoLinks[0].link,
                    filename: videoLinks[0].filename,
                    filesize: videoLinks[0].size || 0,
                    cached: true
                  };
                }

                return {
                  isMultiFile: true,
                  files: videoLinks.map(l => ({
                    id: l.id || l.filename,
                    path: l.filename || '',
                    bytes: l.size || 0,
                    link: l.link
                  })),
                  cached: true
                };
              }
            }
          }
          attempts++;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  async getUser() {
    try {
      const response = await axios.get(`${API_BASE}/user`, {
        params: { agent: this.agent, apikey: this.apiKey },
        timeout: 10000
      });
      return response.data;
    } catch {
      return null;
    }
  }
}

module.exports = AllDebridClient;
