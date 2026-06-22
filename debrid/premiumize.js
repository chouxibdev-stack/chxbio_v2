const axios = require('axios');

const API_BASE = 'https://www.premiumize.me/api';

class PremiumizeClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async resolveMagnet(magnet) {
    try {
      const response = await axios.post(`${API_BASE}/transfer/directdownload`, null, {
        params: { apikey: this.apiKey },
        data: `src=${encodeURIComponent(magnet)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 60000
      });

      if (response.data && response.data.status === 'success') {
        const content = response.data.content || [];
        const videoFiles = content.filter(f =>
          /\.(mp4|mkv|avi|mov|wmv|flv|webm)$/i.test(f.path || f.filename || f.name || '')
        );

        if (videoFiles.length === 0) return null;

        if (videoFiles.length === 1) {
          const dlLink = videoFiles[0].link || videoFiles[0].url || videoFiles[0].direct_download;
          if (dlLink) {
            return {
              url: dlLink,
              filename: videoFiles[0].filename || videoFiles[0].name || videoFiles[0].path || 'video.mp4',
              filesize: videoFiles[0].size || 0,
              cached: true
            };
          }
        }

        return {
          isMultiFile: true,
          files: videoFiles.map(f => ({
            id: f.id || f.filename || f.name,
            path: f.path || f.filename || f.name || '',
            bytes: f.size || 0,
            link: f.link || f.url || ''
          })),
          cached: true
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  async getAccountInfo() {
    try {
      const response = await axios.get(`${API_BASE}/account/info`, {
        params: { apikey: this.apiKey },
        timeout: 10000
      });
      return response.data;
    } catch {
      return null;
    }
  }
}

module.exports = PremiumizeClient;
