// Renders the sign-in planet to a pixelated GIF that loops without a seam.
//
//   node design/moon-gif/render.mjs [--size 200] [--scale 3] [--fps 12.5] [--seconds 12] [--colors 64] [--loading] [--out design/moon-gif/moon.gif]
//   node design/moon-gif/render.mjs --orbit [--settings settings.json] [--scale 2] [--fps 25] [--colors 64] [--out design/moon-gif/moon-orbit.gif]
//
// size = canvas pixels per side, scale = output pixels per canvas pixel (hard edges), so the GIF is size*scale wide.
// Headless Chrome runs the planet (src/client/signInPlanet.ts, unmodified) with a fake clock and window size.
// Plain and --loading: four shader inputs are overridden so the picture repeats: the cloud clock and eddy stay at their first-frame values,
// grain and dither stop changing per frame, and the globe turns exactly once (--loading: the globe holds still and a flat ring turns instead).
// --orbit: renders the playground page (playground.mjs) with its defaults, or with the JSON that its "Copy settings" button gives; size, seconds per loop
// and every look setting come from there.
// Needs Google Chrome (set CHROME for another path) and ffmpeg on PATH.
import { createServer } from 'node:http';
import { stripTypeScriptTypes } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { buildPage, defaults } from './playground.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { values: o } = parseArgs({ options: {
  size: { type: 'string' }, scale: { type: 'string' }, fps: { type: 'string' }, seconds: { type: 'string' }, colors: { type: 'string', default: '64' },
  loading: { type: 'boolean', default: false }, orbit: { type: 'boolean', default: false }, settings: { type: 'string' }, out: { type: 'string' },
} });
const S = o.orbit ? { ...defaults(), ...(o.settings ? JSON.parse(readFileSync(o.settings, 'utf8')) : {}) } : undefined;
const size = S ? S.px : +(o.size ?? 200), colors = +o.colors;
const scale = +(o.scale ?? (S ? Math.max(1, Math.round(600 / size)) : 3));
const fps = +(o.fps ?? (S ? 25 : 12.5));
const frames = Math.round((S ? S.loop : +(o.seconds ?? 12)) * fps);
const out = o.out ?? join(root, S ? 'design/moon-gif/moon-orbit.gif' : 'design/moon-gif/moon.gif');
const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'; // razor: macOS path; CHROME overrides
const dir = mkdtempSync(join(tmpdir(), 'moon-gif-'));

let planetJs = stripTypeScriptTypes(readFileSync(join(root, 'src/client/signInPlanet.ts'), 'utf8'));
// --loading: a ring of fixed shape drawn over the unchanged planet; only its direction (uHalo) turns
const outFrom = 'o = vec4(col + dith / 255., 1.); return;', endFrom = '  o = vec4(col + dith / 255., 1.);\n}', twistFrom = '(1.6 + .2 * tau + uTwist)';
// the same thickness (3% of the radius) all the way round; only the brightness changes, strongest blue mid-arc and fading to nothing at both ends; the arc is 216 degrees, 18 more than half the circle on each side (sin 18 = .309)
const ring = 'float hr = max(0., (dot(q / r, uHalo) + .309) / 1.309); col += mix(uAcc, vec3(.35, .7, 1.), hr) * exp(-pow((r - 1.) / (.03), 2.)) * hr * .9;';
if (o.loading) {
  if (![outFrom, endFrom, twistFrom].every(x => planetJs.includes(x))) throw new Error('signInPlanet.ts shader changed where --loading patches it; update the *From strings in render.mjs');
  planetJs = planetJs
    .replace(outFrom, ring + ' ' + outFrom).replace(endFrom, '  ' + ring + '\n' + endFrom)
    // the extra twist acts only on the storm's core, so its outer swirl does not wobble
    .replace(twistFrom, '(1.6 + .2 * tau + uTwist * smoothstep(.45, .9, gE))').replace('uniform vec3 uL;', 'uniform vec3 uL; uniform vec2 uHalo;');
}
const page = `<!doctype html><canvas id="c"></canvas><script type="module">
import { createPlanet } from '/planet.js';
const SIZE = ${size}, FRAMES = ${frames}, LOADING = ${o.loading};
const post = (path, body) => fetch(path, { method: 'POST', body });
try {
  // the planet sizes its canvas from the window at half a canvas pixel per window pixel
  Object.defineProperty(window, 'innerWidth', { value: SIZE * 2 });
  Object.defineProperty(window, 'innerHeight', { value: SIZE * 2 });
  // fake clock: one planet frame per step()
  let now = 0, pending = null, draws = 0;
  performance.now = () => now;
  window.requestAnimationFrame = cb => { pending = cb; return 1; };
  // shader inputs: remember which location is which name, then override by name
  const proto = WebGL2RenderingContext.prototype, names = new Map(), held = {};
  let rot = 0, loop = 0;
  const getLoc = proto.getUniformLocation, uniform1f = proto.uniform1f, uniform3f = proto.uniform3f, drawArrays = proto.drawArrays;
  proto.getUniformLocation = function (p, n) { const l = getLoc.call(this, p, n); if (l) names.set(l, n); return l; };
  proto.uniform1f = function (l, v) {
    const n = names.get(l);
    if (n === 'uTc' || n === 'uEddyLon' || n === 'uTwist') v = held[n] ??= v;
    if (n === 'uTwist' && LOADING) v += 0.5 * Math.sin(loop); // the storm winds up a little and back, once per loop
    if (n === 'uRot') v = rot;
    else if (n === 'uFrame' || n === 'uGrain') v = 0;
    uniform1f.call(this, l, v);
  };
  proto.uniform3f = function (l, x, y, z) { // the planet centred; the disc fills 78% of the frame so the halo fits
    if (names.get(l) === 'uGeo') { x = SIZE / 2; y = SIZE / 2; z = SIZE * 0.39; }
    if (names.get(l) === 'uL' && LOADING) { // --loading: the flat ring starts on the lit side and turns clockwise
      const a = Math.atan2(y, x) - loop, halo = [...names].find(([, n]) => n === 'uHalo')[0];
      this.uniform2f(halo, Math.cos(a), Math.sin(a));
    }
    uniform3f.call(this, l, x, y, z);
  };
  proto.drawArrays = function (...a) { draws++; return drawArrays.apply(this, a); };

  const canvas = document.getElementById('c');
  const planet = createPlanet(canvas, false);
  if (!planet) throw new Error('createPlanet drew nothing: WebGL 2 is unavailable in this Chrome');
  if (canvas.width !== SIZE) throw new Error('canvas is ' + canvas.width + ' wide, expected ' + SIZE + ': the planet no longer sizes itself at half a pixel per window pixel');
  const step = () => { now += 100; const cb = pending; pending = null; const before = draws; cb(now); if (draws === before) throw new Error('the planet skipped a frame'); };

  step(); // warm-up: the planet reports its first-frame cloud clock and eddy longitude
  const rot0 = held.uEddyLon - 0.5; // first frame: the eddy a little right of centre
  for (let i = 0; i < FRAMES; i++) {
    loop = 2 * Math.PI * i / FRAMES; rot = LOADING ? rot0 : rot0 + loop; // --loading: the globe holds still
    step();
    const bytes = Uint8Array.from(atob(canvas.toDataURL('image/png').split(',')[1]), c => c.charCodeAt(0));
    await post('/frame/' + i, bytes);
  }
  await post('/done', '');
} catch (e) { await post('/error', String(e && e.stack || e)); }
</script>`;

const fail = msg => { console.error(msg); chromeProc.kill(); server.close(); rmSync(dir, { recursive: true, force: true }); process.exit(1); };
let received = 0, chromeProc;
const server = createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  if (pathname === '/') return void res.writeHead(200, { 'content-type': 'text/html' }).end(S ? buildPage() : page);
  if (pathname === '/planet.js') return void res.writeHead(200, { 'content-type': 'text/javascript' }).end(planetJs);
  if (pathname === '/settings.json') return void res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(S));
  const chunks = [];
  req.on('data', c => chunks.push(c)).on('end', () => {
    res.writeHead(204).end();
    const body = Buffer.concat(chunks);
    if (pathname.startsWith('/frame/')) { writeFileSync(join(dir, pathname.slice(7).padStart(4, '0') + '.png'), body); received++; }
    else if (pathname === '/error') fail('Render failed in Chrome:\n' + body);
    else if (pathname === '/done') encode();
  });
});

function encode() {
  if (received !== frames) fail(`expected ${frames} frames, got ${received}`);
  chromeProc.kill(); server.close();
  // scale first with hard edges, then one palette for the whole loop; no dither, so every block stays a flat colour
  const vf = `scale=${size * scale}:${size * scale}:flags=neighbor,split[a][b];[a]palettegen=max_colors=${colors}:stats_mode=full[p];[b][p]paletteuse=dither=none:diff_mode=rectangle`;
  const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(fps), '-i', join(dir, '%04d.png'), '-vf', vf, '-loop', '0', out], { stdio: 'inherit' });
  rmSync(dir, { recursive: true, force: true });
  if (r.status !== 0) process.exit(1);
  console.log(`${out}: ${frames} frames, ${size * scale}x${size * scale}, ${fps} fps, loops forever`);
}

server.listen(0, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}/` + (S ? `?render=1&frames=${frames}` : '');
  chromeProc = spawn(chrome, ['--headless=new', '--no-first-run', '--user-data-dir=' + join(dir, 'profile'), url], { stdio: 'ignore' });
  chromeProc.on('error', e => fail('could not start Chrome: ' + e.message));
  setTimeout(() => fail('timed out after 10 minutes'), 10 * 60_000).unref();
});
