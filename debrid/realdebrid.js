const axios = require('axios');

const API_BASE = 'https://api.real-debrid.com/rest/1.0';

class RealDebridClient {
  constructor(apiToken) {
    this.apiToken = apiToken;
    this.axios = axios.create({
      baseURL: API_BASE,
      timeout: 30000,
      params: { auth_token: apiToken }
    });
  }

  async checkMagnet(magnet) {
    try {
      const response = await this.axios.post('/torrents/addMagnet', null, {
        params: { auth_token: this.apiToken },
        data: `magnet=${encodeURIComponent(magnet)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      return response.data;
    } catch (error) {
      return null;
    }
  }

  async getTorrentInfo(torrentId) {
    try {
      const response = await this.axios.get(`/torrents/info/${torrentId}`, {
        params: { auth_token: this.apiToken }
      });
      return response.data;
    } catch (error) {
      return null;
    }
  }

  async selectFiles(torrentId, fileIds = 'all') {
    try {
      const response = await this.axios.post(`/torrents/selectFiles/${torrentId}`, null, {
        params: { auth_token: this.apiToken },
        data: `files=${fileIds}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      return response.data;
    } catch (error) {
      return null;
    }
  }

  async getUnrestrictedLink(link) {
    try {
      const response = await this.axios.post('/unrestrict/link', null, {
        params: { auth_token: this.apiToken },
        data: `link=${encodeURIComponent(link)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      return response.data;
    } catch (error) {
      return null;
    }
  }

  async resolveMagnet(magnet) {
    try {
      const addResult = await this.checkMagnet(magnet);
      if (!addResult || !addResult.id) return null;

      const torrentInfo = await this.getTorrentInfo(addResult.id);
      if (!torrentInfo) return null;

      if (torrentInfo.status === 'magnet_error') return null;

      if (torrentInfo.files && torrentInfo.files.length > 0) {
        const videoFiles = torrentInfo.files
          .map((f, idx) => ({ ...f, id: f.id || idx }))
          .filter(f => /\.(mp4|mkv|avi|mov|wmv|flv|webm)$/i.test(f.path || f.filename || ''));

        if (videoFiles.length === 0) return null;

        const fileIds = videoFiles.map(f => f.id).join(',');
        await this.selectFiles(torrentInfo.id, fileIds);

        await this.waitTorrentReady(torrentInfo.id);

        if (videoFiles.length === 1) {
          const unrestrict = await this.getUnrestrictedLink(videoFiles[0].link);
          if (unrestrict && unrestrict.download) {
            return {
              url: unrestrict.download,
              filename: videoFiles[0].filename || videoFiles[0].path || 'video.mp4',
              filesize: videoFiles[0].bytes || 0,
              cached: torrentInfo.status === 'downloaded' || torrentInfo.status === 'magnet_conversion'
            };
          }
        }

        return {
          isMultiFile: true,
          files: videoFiles.map(f => ({
            id: f.id,
            path: f.path || f.filename || '',
            bytes: f.bytes || 0
          })),
          torrentId: torrentInfo.id,
          cached: torrentInfo.status === 'downloaded' || torrentInfo.status === 'magnet_conversion'
        };
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  async waitTorrentReady(torrentId, maxAttempts = 10) {
    for (let i = 0; i < maxAttempts; i++) {
      const info = await this.getTorrentInfo(torrentId);
      if (!info) return false;
      if (info.status === 'downloaded') return true;
      if (info.status === 'error' || info.status === 'magnet_error') return false;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    return false;
  }

  async getUser() {
    try {
      const response = await this.axios.get('/user', {
        params: { auth_token: this.apiToken }
      });
      return response.data;
    } catch {
      return null;
    }
  }
}

module.exports = RealDebridClient;
