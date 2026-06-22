const RealDebridClient = require('./realdebrid');
const AllDebridClient = require('./alldebrid');
const PremiumizeClient = require('./premiumize');

let realDebridClient = null;
let allDebridClient = null;
let premiumizeClient = null;

function init() {
  const rdToken = process.env.REAL_DEBRID_API_TOKEN || '';
  const adKey = process.env.ALLDEBRID_API_KEY || '';
  const pmKey = process.env.PREMIUMIZE_API_KEY || '';

  if (rdToken) {
    realDebridClient = new RealDebridClient(rdToken);
    console.log('[Debrid] Real-Debrid initialized');
  }
  if (adKey) {
    allDebridClient = new AllDebridClient(adKey);
    console.log('[Debrid] AllDebrid initialized');
  }
  if (pmKey) {
    premiumizeClient = new PremiumizeClient(pmKey);
    console.log('[Debrid] Premiumize initialized');
  }

  if (!rdToken && !adKey && !pmKey) {
    console.log('[Debrid] No debrid service configured - returning direct magnet links');
  }
}

function getActiveDebridServices() {
  const services = [];
  if (realDebridClient) services.push({ name: 'Real-Debrid', client: realDebridClient });
  if (allDebridClient) services.push({ name: 'AllDebrid', client: allDebridClient });
  if (premiumizeClient) services.push({ name: 'Premiumize', client: premiumizeClient });
  return services;
}

async function resolveMagnet(magnet, preferredService = 'realdebrid') {
  const services = getActiveDebridServices();
  if (services.length === 0) return null;

  const priority = preferredService.toLowerCase();
  services.sort((a, b) => {
    const aMatch = a.name.toLowerCase().includes(priority) ? -1 : 1;
    const bMatch = b.name.toLowerCase().includes(priority) ? -1 : 1;
    return aMatch - bMatch;
  });

  for (const service of services) {
    try {
      const result = await service.client.resolveMagnet(magnet);
      if (result) {
        result.debridService = service.name;
        return result;
      }
    } catch {
      continue;
    }
  }

  return null;
}

async function getDebridUserInfo() {
  const info = {};

  if (realDebridClient) {
    try {
      const user = await realDebridClient.getUser();
      if (user) info.realdebrid = { username: user.username, email: user.email, premium: user.premium };
    } catch {}
  }

  if (allDebridClient) {
    try {
      const user = await allDebridClient.getUser();
      if (user) info.alldebrid = { ...(user.data || user) };
    } catch {}
  }

  if (premiumizeClient) {
    try {
      const account = await premiumizeClient.getAccountInfo();
      if (account) info.premiumize = { ...(account.data || account) };
    } catch {}
  }

  return info;
}

module.exports = { init, resolveMagnet, getActiveDebridServices, getDebridUserInfo };
