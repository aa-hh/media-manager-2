// Stand-in Sonarr for the Pick a release screenshots: the repo's arr fake behind a real HTTP port.
// Not run by hand: start.sh launches it on SHOTS_SONARR_PORT (default 65301) and stop.sh stops it.
import { createServer } from 'node:http';
import { createArrFake, historyRecord } from '../../tests/fakes/arr.mjs';

const fake = createArrFake({ apiKey: 'test-key' });
fake.state.series = [{
  id: 5, title: 'Severance', year: 2022, monitored: true, tags: [], images: [], qualityProfileId: 1, path: '/tv/Severance',
  seasons: [{ seasonNumber: 2, monitored: true, statistics: { episodeFileCount: 1, episodeCount: 10, totalEpisodeCount: 10, sizeOnDisk: 4100000000 } }],
}];
const titles = ['Episode 1', 'Episode 2', 'Episode 3', "Woe's Hollow", "Trojan's Horse", 'Attila', 'Chikhai Bardo', 'Sweet Vitriol', 'The After Hours', 'Cold Harbor'];
fake.state.episodes = titles.map((title, index) => ({
  id: 201 + index, seriesId: 5, seasonNumber: 2, episodeNumber: index + 1, title, monitored: true,
  airDateUtc: new Date(Date.UTC(2026, 6, 4) + index * 7 * 86_400_000).toISOString(),
  hasFile: index === 7,
  // Trackers number episode 208 differently, so its inset shows the one-line numbering notice.
  ...(index === 7 ? { sceneSeasonNumber: 2, sceneEpisodeNumber: 7 } : {}),
  ...(index === 7 ? {
    episodeFile: {
      id: 9, relativePath: 'Season 2/Severance.S02E08.1080p.ATVP.WEB-DL.DDP5.1.H.264-FLOS.mkv', size: 4_100_000_000, releaseGroup: 'FLOS',
      customFormatScore: 40, qualityCutoffNotMet: false,
      quality: { quality: { name: 'WEBDL-1080p' }, revision: { version: 1, real: 0 } },
      mediaInfo: { audioCodec: 'EAC3', audioChannels: 5.1, videoDynamicRangeType: '' },
    },
  } : {}),
}));

const indexers = { PrivateHD: 1, 'Beyond-HD': 2, Blutopia: 3 };
const release = (guid, title, quality, indexer, seeders, score, size, extra = {}) => ({
  guid, indexerId: indexers[indexer], indexer, title, quality: { quality: { name: quality } }, size, ageHours: 30 + guid.length,
  seeders, leechers: 3, approved: true, rejections: [], customFormatScore: score, customFormats: score === 0 ? [] : [{ name: 'Tier' }],
  indexerFlags: 0, protocol: 'torrent', downloadUrl: `https://indexer.test/${guid}`, mappedEpisodeInfo: [{ id: 208 }], episodeRequested: true, ...extra,
});
const failedBefore = 'Severance.S02E08.1080p.ATVP.WEB-DL.DDP5.1.H.264-NTb';
const forEpisode208 = [
  release('r01', 'Severance.S02E08.2160p.ATVP.WEB-DL.DV.HDR10.DDP5.1.Atmos.H.265-FLUX', 'WEBDL-2160p', 'PrivateHD', 312, 120, 8_900_000_000, { indexerFlags: 1 }),
  release('r02', 'Severance.S02E08.PROPER.2160p.ATVP.WEB-DL.HDR10.DDP5.1.H.265-NTb', 'WEBDL-2160p', 'Beyond-HD', 188, 40, 7_400_000_000),
  release('r03', 'Severance.S02E08.2160p.ATVP.WEB-DL.DV.DDP5.1.H.265-HHWEB', 'WEBDL-2160p', 'PrivateHD', 8, 100, 8_200_000_000),
  release('r04', 'Severance.S02E08.2160p.AMZN.WEB-DL.DDP5.1.HDR10.H.265-CMRG', 'WEBDL-2160p', 'Beyond-HD', 44, 40, 7_900_000_000),
  release('r05', 'Severance.S02E08.2160p.WEB.H265-SuccessfulCrab', 'WEBRip-2160p', 'Beyond-HD', 96, -50, 5_100_000_000),
  release('r06', failedBefore, 'WEBDL-1080p', 'Beyond-HD', 233, 40, 4_000_000_000),
  release('r07', 'Severance.S02E08.Sweet.Vitriol.1080p.AMZN.WEB-DL.DDP5.1.H.264-FLOS', 'WEBDL-1080p', 'PrivateHD', 0, 40, 4_100_000_000),
  release('r08', 'Severance.S02E08.1080p.ATVP.WEB-DL.DDP5.1.H.264-playWEB', 'WEBDL-1080p', 'Blutopia', 57, 10, 4_100_000_000),
  release('r09', 'Severance.S02E08.1080p.WEB.H264-SuccessfulCrab', 'WEBRip-1080p', 'Beyond-HD', 140, 0, 3_200_000_000),
  release('r10', 'Severance.S02E08.1080p.ATVP.WEB-DL.DDP5.1.Atmos.H.264-FLUX', 'WEBDL-1080p', 'PrivateHD', 410, 40, 4_300_000_000),
  release('r11', 'Severance.S02E08.720p.ATVP.WEB-DL.DDP5.1.H.264-FLUX', 'WEBDL-720p', 'PrivateHD', 64, 0, 1_900_000_000,
    { approved: false, rejections: [{ reason: 'WEBDL-720p is not wanted in profile' }] }),
  release('r12', 'Severance.S02E08.720p.WEB.H264-NOSIVID', 'WEBRip-720p', 'Beyond-HD', 41, 0, 1_600_000_000),
];
const forEpisode207 = ['A', 'B', 'C'].map((letter, index) => release(`o${index}`, `Severance.S02E0${6 + index % 2}.1080p.WEB.H264-GRP${letter}`, 'WEBDL-1080p', 'Beyond-HD', 20, 0, 3_000_000_000,
  { episodeRequested: false, mappedEpisodeInfo: [{ id: 206 }] }));
fake.state.history.push(historyRecord({ eventType: 'downloadFailed', sourceTitle: failedBefore, seriesId: 5, date: '2026-10-01T10:00:00Z' }));

fake.routes.push(async (method, url) => {
  if (url.pathname === '/api/v3/release' && method === 'GET') {
    const episodeId = url.searchParams.get('episodeId');
    if (episodeId === '208') return { status: 200, body: forEpisode208 };
    if (episodeId === '207') return { status: 200, body: forEpisode207 };
    return { status: 200, body: [] };
  }
  if (url.pathname === '/api/v3/release' && method === 'POST') {
    await new Promise((resolve) => setTimeout(resolve, 20_000));
    return { status: 200, body: {} };
  }
  if (url.pathname === '/api/v3/qualityprofile/1' && method === 'GET') {
    return { status: 200, body: { items: [{ quality: { name: 'HDTV-720p' }, items: [] }, { quality: { name: 'WEBDL-1080p' }, items: [] }, { quality: { name: 'WEBDL-2160p' }, items: [] }] } };
  }
  return undefined;
});

createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length === 0 ? undefined : Buffer.concat(chunks).toString('utf8');
  const url = new URL(req.url, 'http://127.0.0.1');
  const headers = Object.fromEntries(Object.entries(req.headers).filter(([, value]) => typeof value === 'string'));
  const response = await fake.fetch(url, { method: req.method, headers, body });
  console.log(`${req.method} ${url.pathname}${url.search} -> ${response.status}`);
  res.writeHead(response.status, { 'Content-Type': 'application/json' });
  res.end(await response.text());
}).listen(Number(process.env.SHOTS_SONARR_PORT ?? 65301), '127.0.0.1', function () { console.log(`stand-in Sonarr on 127.0.0.1:${this.address().port}`); });
