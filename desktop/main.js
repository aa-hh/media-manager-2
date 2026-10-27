'use strict';
const { app, BrowserWindow, Menu, ipcMain, net, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, randomUUID } = require('node:crypto');
const { normaliseAddress, isMediaManager } = require('./lib/address');
const { chooseConnection, PROBE_TIMEOUT_MS } = require('./lib/connection');
const { nextStep, planLabel } = require('./lib/retry');
const { originOf, pageCopy, pageTrack, callerAllowed } = require('./lib/page');
const { fileEvent, playsOnOpen, subtitleAdd } = require('./lib/player');

const MiB = 1024 * 1024;
const DEFAULT_LOAD_AHEAD = 512 * MiB; // recommendation 4
const ADDRESS_PAGE = path.join(__dirname, 'address', 'index.html');
// A world of its own in the app window: the page's scripts cannot reach it, so a reply read there never reaches the page.
const PRIVATE_WORLD = 1001;

// The packaged app carries MoltenVK; the Vulkan loader finds it through this driver file, never through Homebrew.
const driverFile = path.join(process.resourcesPath, 'vulkan', 'MoltenVK_icd.json');
if (app.isPackaged && fs.existsSync(driverFile)) {
  process.env.VK_DRIVER_FILES = driverFile;
  process.env.VK_ICD_FILENAMES = driverFile;
}

// --- Settings kept in userData: the address, the client id (network §1), Load ahead.

const settingsPath = () => path.join(app.getPath('userData'), 'desktop.json');
const readSettings = () => {
  try {
    const value = JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
    return typeof value === 'object' && value !== null ? value : {};
  } catch {
    return {};
  }
};
const writeSettings = (changes) => {
  const next = { ...readSettings(), ...changes };
  const temporary = `${settingsPath()}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(next, null, 2));
  fs.renameSync(temporary, settingsPath());
  return next;
};
const clientId = () => {
  const saved = readSettings().clientId;
  if (typeof saved === 'string' && /^[A-Za-z0-9_-]{24}$/.test(saved)) return saved;
  return writeSettings({ clientId: randomBytes(18).toString('base64url') }).clientId;
};
const loadAheadBytes = () => {
  const saved = readSettings().loadAheadBytes;
  return Number.isSafeInteger(saved) && saved > 0 ? saved : DEFAULT_LOAD_AHEAD;
};
// One per app run (network §1).
const sessionIdentifier = randomUUID();

let win;
let appOrigin = null;

// --- Windows and navigation

const isHttp = (url) => /^https?:/i.test(url) || /^mailto:/i.test(url);
const openOutside = (url) => { if (isHttp(url)) void shell.openExternal(url); };
const isAddressPage = (url) => url.startsWith('file:') && decodeURIComponent(new URL(url).pathname) === ADDRESS_PAGE;

const showAddressPage = (query = {}) => {
  stopPlayer();
  void win.loadFile(ADDRESS_PAGE, { query });
};
const showApp = (origin) => {
  appOrigin = origin;
  // Another address can mean another Plex server: its id and address are found again.
  serverId = undefined;
  keptOrigin = null;
  void win.loadURL(origin);
};

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 560,
    // Transparent, so mpv's picture shows through the player area the page leaves clear.
    transparent: true,
    backgroundColor: '#00000000',
    // No visible title bar: in fullscreen this window takes mpv's frame exactly.
    titleBarStyle: 'hidden',
    // macOS fullscreen would move only this window to a new Space; the player's fullscreen is mpv's (setFullscreen).
    fullscreenable: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true },
  });

  const contents = win.webContents;
  contents.on('will-navigate', (event, url) => {
    if (originOf(url) === appOrigin || isAddressPage(url)) return;
    event.preventDefault();
    openOutside(url);
  });
  // The Plex sign-in (src/client/plexPopup.ts) opens about:blank, then sends it to app.plex.tv.
  contents.setWindowOpenHandler(({ url }) => {
    if (url === 'about:blank' || originOf(url) === 'https://app.plex.tv') {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: { transparent: false, backgroundColor: '#ffffff', titleBarStyle: 'default', fullscreenable: true },
      };
    }
    openOutside(url);
    return { action: 'deny' };
  });
  contents.on('did-fail-load', (_event, code, _description, url, isMainFrame) => {
    // -3 is a navigation the page replaced itself; anything else on the app means the address did not answer.
    if (!isMainFrame || code === -3 || originOf(url) !== appOrigin) return;
    showAddressPage({ address: appOrigin, error: 'no_answer' });
  });

  // Trap: Electron 45 documents 'moved' as an alias of 'move' on macOS, so the name alone does not make this once per drag.
  win.on('moved', () => mpv?.matchFrame());
  win.on('resized', () => mpv?.matchFrame());
  let layoutTimer;
  win.on('resize', () => {
    clearTimeout(layoutTimer);
    layoutTimer = setTimeout(applyLayout, 100); // once the size settles, not per animation step
  });
  win.on('close', () => {
    if (mpv) mpv.destroy();
    mpv = null;
  });

  const saved = normaliseAddress(readSettings().address);
  if (saved === null) showAddressPage();
  else showApp(saved);
}

const changeAddress = () => showAddressPage(appOrigin === null ? {} : { address: appOrigin });

Menu.setApplicationMenu(Menu.buildFromTemplate([
  {
    role: 'appMenu',
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { label: 'Change Server Address…', click: changeAddress },
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' },
    ],
  },
  { role: 'editMenu' },
  { role: 'viewMenu' },
  { role: 'windowMenu' },
]));

// --- First-launch address (C1.1)

ipcMain.handle('address:submit', async (event, input) => {
  if (event.sender !== win?.webContents || !isAddressPage(event.senderFrame?.url ?? '')) return { error: 'invalid' };
  const origin = normaliseAddress(input);
  if (origin === null) return { error: 'invalid' };
  try {
    const response = await net.fetch(`${origin}/auth/status`, {
      headers: { Accept: 'application/json' },
      credentials: 'omit',
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (!isMediaManager(response.status, body)) return { error: 'not_media_manager' };
  } catch {
    return { error: 'no_answer' };
  }
  writeSettings({ address: origin });
  showApp(origin);
  return { ok: true };
});

// --- Requests to the app, from the private world, with the page's cookie and origin

const appRequest = async (method, pathname, body) => {
  const code = `(async () => {
    const response = await fetch(${JSON.stringify(pathname)}, {
      method: ${JSON.stringify(method)},
      credentials: 'same-origin',
      headers: ${JSON.stringify({
        Accept: 'application/json',
        ...(method === 'POST' ? { 'Content-Type': 'application/json', 'X-Requested-With': 'media-manager-2', 'X-Media-Manager-Desktop': '1' } : {}),
      })},
      ${method === 'POST' ? `body: ${JSON.stringify(JSON.stringify(body))},` : ''}
    });
    let json = null;
    try { json = await response.json(); } catch {}
    return { status: response.status, json };
  })()`;
  return win.webContents.executeJavaScriptInIsolatedWorld(PRIVATE_WORLD, [{ code }]);
};

// The Plex server's id, from the library reply's watch status (src/server/watchStatus.ts); null when Plex is down.
let serverId;
const expectedServerId = async () => {
  if (typeof serverId === 'string') return serverId;
  try {
    const { status, json } = await appRequest('GET', '/api/library/titles');
    const id = status === 200 ? json?.watch?.machineIdentifier : undefined;
    if (typeof id === 'string' && id !== '') serverId = id;
  } catch {
    // Unknown: only https plex.direct addresses pass (lib/connection.js).
  }
  return serverId ?? null;
};

// --- Choosing the Plex address (C1.4)

const probe = async (origin) => {
  const response = await net.fetch(`${origin}/identity`, {
    headers: { Accept: 'application/json' },
    credentials: 'omit',
    redirect: 'error',
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
  });
  if (response.status !== 200) return null;
  const body = await response.json();
  return body?.MediaContainer?.machineIdentifier ?? null;
};
// Kept for the run; tested again before any retry (network recommendation 7).
let keptOrigin = null;
const pickOrigin = async (origins, retest) => {
  if (!retest && keptOrigin !== null && origins.includes(keptOrigin)) return keptOrigin;
  keptOrigin = await chooseConnection(origins, probe, await expectedServerId());
  return keptOrigin;
};

// --- mpv (C1.3)

let mpv = null;
let layout = 'full';
let fullscreen = false;
let current = null; // the title playing: what was asked, the plan, the kept address, the owner's pause and the retry counts
// The title whose file mpv last opened. mpv's file events belong to it, so they are ignored once a newer load replaces it.
let loaded = null;

const OBSERVED = ['time-pos', 'duration', 'pause', 'paused-for-cache', 'demuxer-cache-duration', 'track-list'];
const send = (name, value) => {
  if (win && !win.isDestroyed()) win.webContents.send('player:event', name, value);
};
const number = (value) => (value === null || value === undefined || value === '' ? null : Number(value));

const ensureMpv = () => {
  if (mpv) return mpv;
  const { MpvView } = require('./build/Release/mpvview.node');
  mpv = new MpvView(win.getNativeWindowHandle());
  // Plex addresses must never go to youtube-dl or yt-dlp.
  void mpv.setOption('ytdl', 'no');
  for (const name of OBSERVED) mpv.observe(name);
  mpv.onEvent(onMpvEvent);
  return mpv;
};

const TRACK_FIELDS = { id: 'number', type: 'string', 'ff-index': 'number', lang: 'string', title: 'string', codec: 'string', external: 'boolean', selected: 'boolean', default: 'boolean' };
// mpv only gives the whole track list as display text over this addon, so it is read field by field.
const readTracks = async () => {
  const count = number(await mpv.getProperty('track-list/count')) ?? 0;
  return Promise.all(Array.from({ length: count }, async (_, index) => Object.fromEntries(await Promise.all(
    Object.entries(TRACK_FIELDS).map(async ([field, type]) => {
      const value = await mpv.getProperty(`track-list/${index}/${field}`);
      return [field, value === null ? null : type === 'number' ? Number(value) : type === 'boolean' ? value === 'yes' : value];
    }),
  )).then(pageTrack)));
};

function onMpvEvent(event) {
  if (event.event === 'property-change') {
    const { name, value } = event;
    if (name === 'time-pos') {
      const position = number(value);
      if (position === null) return;
      if (current) {
        current.position = position;
        // Playback moved: the plan works, and the retry counts start again.
        if (position > current.startedAt + 5) {
          current.played = true;
          current.tries = { token: 0, same: 0 };
        }
      }
      send('position', position);
    } else if (name === 'duration') {
      if (current) current.duration = number(value);
      send('duration', number(value));
    } else if (name === 'pause') send('paused', value === 'yes');
    else if (name === 'paused-for-cache') send('buffering', value === 'yes');
    else if (name === 'demuxer-cache-duration') send('loadedAhead', number(value));
    else if (name === 'track-list') readTracks().then((tracks) => send('tracks', tracks), () => {});
  } else if (event.event === 'log-message') {
    if (current && /HTTP error 401/i.test(String(event.value))) current.unauthorized = true;
  } else if (event.event === 'file-loaded' || event.event === 'end-file') {
    const meaning = fileEvent(event, current, loaded);
    if (meaning === 'opened') startPlaying().catch(() => {}); // a track that cannot be picked still plays, with mpv's own choice
    else if (meaning === 'finished') {
      current = null;
      send('endOfFile');
    } else if (meaning !== null) void recover(meaning);
  } else if (event.event === 'window' && event.name === 'attached') {
    applyLayout();
  }
}

// After the file opens paused: pick the tracks, then unpause (the on_preloaded order in network §9), unless the owner
// paused the title.
async function startPlaying() {
  if (!current) return;
  const playing = current;
  const { reply } = playing;
  try {
    if (reply.decision.directPlay) {
      const tracks = await readTracks();
      const audio = reply.tracks.audio.find((track) => track.selected);
      const audioTrack = audio ? tracks.filter((track) => track.type === 'audio')[audio.index] : undefined;
      if (audioTrack) await mpv.setProperty('aid', String(audioTrack.id));
      const subtitle = reply.tracks.subtitle.find((track) => track.selected);
      if (subtitle) await selectSubtitle({ url: subtitle.external ? subtitle.key : null, ffIndex: subtitle.ffIndex }, tracks);
    }
  } finally {
    if (playsOnOpen(playing)) await mpv.setProperty('pause', 'no');
  }
}

// --- Loading (C1.2 load, C1.3 options, C1.5 retries)

const requestBody = (ask, flags, offsetSeconds) => ({
  ratingKey: ask.ratingKey,
  mediaIndex: ask.mediaIndex,
  partIndex: ask.partIndex,
  offsetSeconds: Math.max(0, Math.floor(offsetSeconds)),
  directPlay: flags.directPlay,
  directStream: flags.directStream,
  directStreamAudio: flags.directStreamAudio,
  ...(flags.maxVideoBitrate === undefined ? {} : { maxVideoBitrate: flags.maxVideoBitrate }),
  clientId: clientId(),
  sessionIdentifier,
});

async function loadAddress(playing, address, startSeconds, directPlay) {
  ensureMpv();
  const options = [
    ['demuxer-lavf-probe-info', 'yes'],
    ['demuxer-mkv-probe-start-time', 'no'],
    ['demuxer-seekable-cache', 'yes'],
    ['tls-verify', 'yes'],
    ['pause', 'yes'],
    ['sub-create-cc-track', 'yes'],
    ['hwdec', 'auto'],
    ['network-timeout', '15'],
    ['demuxer-max-bytes', String(loadAheadBytes())],
    ['demuxer-max-back-bytes', String(50 * MiB)],
    ['stream-lavf-o', directPlay ? 'reconnect=1,reconnect_on_network_error=1,reconnect_delay_max=5' : ''],
    // A transcode already starts at its offset (copyts=1 keeps the file's times), so only direct play seeks.
    ['start', directPlay ? `+${startSeconds}` : 'none'],
  ];
  await Promise.all(options.map(([name, value]) => mpv.setOption(name, value)));
  if (current !== playing) throw new Error('replaced');
  playing.unauthorized = false;
  playing.startedAt = startSeconds;
  playing.position = startSeconds;
  loaded = playing;
  await mpv.command(['loadfile', address, 'replace']);
}

// One /api/playback/start, a tested Plex address, and mpv loading it. `playing` is the title asked for; a newer load or a stop replaces it.
async function start(playing, offsetSeconds, retest) {
  const { status, json } = await appRequest('POST', '/api/playback/start', requestBody(playing.ask, playing.flags, offsetSeconds));
  if (status !== 200 || json === null || !Array.isArray(json.streamAddresses)) {
    throw new Error(typeof json?.error === 'string' ? json.error : `start failed (${status})`);
  }
  const addresses = json.streamAddresses.filter((address) => typeof address === 'string');
  const origin = await pickOrigin(addresses.map(originOf).filter((value) => value !== null), retest);
  if (origin === null) throw new Error('plex_unreachable');
  if (current !== playing) throw new Error('replaced');
  playing.reply = json;
  playing.address = addresses.find((address) => originOf(address) === origin);
  // The sub-add command for each external subtitle file, by its tokenless stream key.
  playing.subtitles = new Map(json.tracks.subtitle
    .filter((track) => track.external && typeof track.url === 'string')
    .map((track) => [track.key, subtitleAdd(track, origin)]));
  await loadAddress(playing, playing.address, offsetSeconds, json.decision.directPlay);
  return pageCopy(json);
}

async function recover(failure, playing = current) {
  if (!playing || current !== playing) return;
  const step = nextStep(playing.flags, failure, playing.played, playing.tries);
  if (step.kind === 'give-up') {
    current = null;
    send('error', { message: 'Plex couldn’t play this, in any of the ways tried.', tried: playing.tried });
    return;
  }
  if (step.kind === 'reload') playing.tries[step.count] += 1;
  else {
    playing.flags = step.flags;
    playing.played = false;
    playing.tries = { token: 0, same: 0 };
    playing.tried.push(planLabel(step.flags));
  }
  try {
    const reply = await start(playing, playing.position, true);
    if (current === playing) send('started', reply);
  } catch {
    if (current === playing) setTimeout(() => void recover('failed', playing), 5_000);
  }
}

const isCount = (value) => Number.isSafeInteger(value) && value >= 0;
const readAsk = (ask) => {
  const flags = ask?.flags;
  if (typeof ask?.ratingKey !== 'string' || !/^\d+$/.test(ask.ratingKey) || !isCount(ask.mediaIndex) || !isCount(ask.partIndex)
    || typeof ask.offsetSeconds !== 'number' || !Number.isFinite(ask.offsetSeconds) || ask.offsetSeconds < 0
    || typeof flags?.directPlay !== 'boolean' || typeof flags.directStream !== 'boolean' || typeof flags.directStreamAudio !== 'boolean'
    || (flags.maxVideoBitrate !== undefined && !isCount(flags.maxVideoBitrate))) throw new Error('invalid_request');
  return {
    ask: { ratingKey: ask.ratingKey, mediaIndex: ask.mediaIndex, partIndex: ask.partIndex },
    offsetSeconds: ask.offsetSeconds,
    flags: {
      directPlay: flags.directPlay,
      directStream: flags.directStream,
      directStreamAudio: flags.directStreamAudio,
      ...(flags.maxVideoBitrate === undefined ? {} : { maxVideoBitrate: flags.maxVideoBitrate }),
    },
  };
};

function stopPlayer() {
  current = null;
  if (!mpv) return;
  if (fullscreen) void setFullscreen(false);
  void mpv.command(['stop']).catch(() => {});
}

// --- Layout (C0 result: no window moves; the picture is placed with video-margin-ratio-*)

const MINI = { width: 360, height: 203, inset: 24 };
const marginsFor = (wanted, [width, height], zoom) => {
  let box;
  if (wanted === 'mini') box = { x: width - MINI.inset - MINI.width, y: height - MINI.inset - MINI.height, width: MINI.width, height: MINI.height };
  else if (typeof wanted === 'object') box = { x: wanted.x * zoom, y: wanted.y * zoom, width: wanted.width * zoom, height: wanted.height * zoom };
  if (!box || box.x < 0 || box.y < 0 || box.width < 1 || box.height < 1 || box.x + box.width > width || box.y + box.height > height) {
    return { left: 0, right: 0, top: 0, bottom: 0 };
  }
  return { left: box.x / width, right: (width - box.x - box.width) / width, top: box.y / height, bottom: (height - box.y - box.height) / height };
};

function applyLayout() {
  if (!mpv || !win || win.isDestroyed()) return;
  const margins = marginsFor(layout, win.getContentSize(), win.webContents.getZoomFactor());
  for (const [side, ratio] of Object.entries(margins)) void mpv.setProperty(`video-margin-ratio-${side}`, String(ratio)).catch(() => {});
}

async function setFullscreen(on) {
  fullscreen = on;
  win.setWindowButtonVisibility(!on);
  if (mpv) await mpv.setFullscreen(on);
}

// --- The bridge (C1.2): every handler answers only the app window showing the app.

const handle = (channel, run) => ipcMain.handle(channel, (event, ...args) => {
  const frame = event.senderFrame; // null once the frame has navigated away
  if (!callerAllowed({
    fromAppWindow: event.sender === win?.webContents,
    mainFrame: frame?.parent === null,
    frameUrl: frame?.url ?? '',
    appOrigin,
  })) throw new Error('not_allowed');
  return run(...args);
});
const ready = () => {
  if (!mpv) throw new Error('nothing_playing');
  return mpv;
};
const finite = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('invalid_request');
  return value;
};

handle('player:load', async (ask) => {
  const { ask: wanted, offsetSeconds, flags } = readAsk(ask);
  current = { ask: wanted, flags, tried: [planLabel(flags)], tries: { token: 0, same: 0 }, played: false, paused: false, position: offsetSeconds, duration: null };
  const playing = current;
  // The old file ends now, with reason stop, so it cannot fail or finish into this load while its start request runs.
  if (mpv) void mpv.command(['stop']).catch(() => {});
  try {
    return await start(playing, offsetSeconds, false);
  } catch (error) {
    if (current === playing) current = null;
    throw error;
  }
});
// The owner's own choice is kept on the title: every load sets mpv's pause to yes, so mpv's value cannot tell it.
const setPaused = (paused) => {
  const player = ready();
  if (current) current.paused = paused;
  return player.setProperty('pause', paused ? 'yes' : 'no');
};
handle('player:play', () => setPaused(false));
handle('player:pause', () => setPaused(true));
handle('player:stop', () => stopPlayer());
handle('player:seek', async (seconds) => {
  const target = Math.max(0, finite(seconds));
  if (!current) return ready().command(['seek', String(target), 'absolute+exact']);
  if (!current.reply || current.reply.decision.directPlay) return ready().command(['seek', String(target), 'absolute+exact']);
  // A transcode seeks by asking for the kept address again from a new offset: same session, no new decision (network §4).
  const url = new URL(current.address);
  url.searchParams.set('offset', String(Math.floor(target)));
  current.address = url.toString();
  // The reload opens paused; startPlaying unpauses it unless the owner paused.
  return loadAddress(current, current.address, Math.floor(target), false);
});
handle('player:setAudio', async (index) => {
  ready();
  const tracks = (await readTracks()).filter((track) => track.type === 'audio');
  const track = tracks[finite(index)];
  if (!track) throw new Error('no_such_track');
  return mpv.setProperty('aid', String(track.id));
});
async function selectSubtitle({ url, ffIndex }, tracks) {
  if (typeof url === 'string') {
    const add = current?.subtitles.get(url);
    if (add === undefined) throw new Error('no_such_track');
    // network §9: the previous external file goes, then the new one is added and selected.
    for (const track of tracks.filter((entry) => entry.type === 'sub' && entry.external)) await mpv.command(['sub-remove', String(track.id)]);
    return mpv.command(add);
  }
  if (typeof ffIndex === 'number') {
    const track = tracks.find((entry) => entry.type === 'sub' && entry['ff-index'] === ffIndex);
    if (!track) throw new Error('no_such_track');
    return mpv.setProperty('sid', String(track.id));
  }
  return mpv.setProperty('sid', 'no');
}
handle('player:setSubtitle', async (choice) => {
  ready();
  return selectSubtitle({ url: choice?.url ?? null, ffIndex: choice?.ffIndex ?? null }, await readTracks());
});
handle('player:setSubtitleDelay', (seconds) => ready().setProperty('sub-delay', String(finite(seconds))));
handle('player:setLoadAhead', (bytes) => {
  if (!Number.isSafeInteger(bytes) || bytes < 16 * MiB || bytes > 8192 * MiB) throw new Error('invalid_request');
  writeSettings({ loadAheadBytes: bytes });
  if (mpv) return mpv.setProperty('demuxer-max-bytes', String(bytes));
});
handle('player:getLoadAhead', () => loadAheadBytes());
handle('player:setLayout', (wanted) => {
  if (wanted !== 'full' && wanted !== 'mini') {
    if (typeof wanted !== 'object' || wanted === null) throw new Error('invalid_request');
    wanted = { x: finite(wanted.x), y: finite(wanted.y), width: finite(wanted.width), height: finite(wanted.height) };
  }
  layout = wanted;
  applyLayout();
});
handle('player:setFullscreen', (on) => setFullscreen(on === true));

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
