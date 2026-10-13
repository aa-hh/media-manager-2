// Builds design/moon-gif/playground.html: the orbit version of the sign-in planet running live, with a control for every setting.
//
//   node design/moon-gif/playground.mjs        then open design/moon-gif/playground.html (double-click it)
//
// The page holds the planet's own shader (src/client/signInPlanet.ts, unmodified on disk) with the same patches render.mjs --orbit applies,
// except that colours, halo shape and orbit are shader inputs here so the controls can change them while it runs.
// Defaults match the current moon-orbit.gif. "Copy settings" puts the current values on the clipboard as JSON.
import { stripTypeScriptTypes } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
let planetJs = stripTypeScriptTypes(readFileSync(join(root, 'src/client/signInPlanet.ts'), 'utf8'));

const from = {
  out: 'o = vec4(col + dith / 255., 1.); return;', end: '  o = vec4(col + dith / 255., 1.);\n}', twist: '(1.6 + .2 * tau + uTwist)',
  seed: 'float sd = n * .4456;', eddy: 'const float ELAT = -0.32, EA = 0.42, EB = 0.22;', pal: 'col = pal(v) * sh + uAcc * (haze + rim);', uni: 'uniform vec3 uL;',
};
if (!Object.values(from).every(x => planetJs.includes(x))) throw new Error('signInPlanet.ts shader changed where the playground patches it; update `from` in playground.mjs');

// the ring: an ellipse around the planet's centre; its front half (lower half of the picture) is drawn over the face, its back half only where the planet is not in the way
const ring = front => `vec2 qr = vec2(uOrbit.z * q.x + uOrbit.w * q.y, -uOrbit.w * q.x + uOrbit.z * q.y);
    vec2 ou = qr / vec2(uOrbit.x, uOrbit.x * uOrbit.y); float ol = max(length(ou), 1e-4);
    vec2 og = vec2(qr.x / (uOrbit.x * uOrbit.x), qr.y / pow(uOrbit.x * uOrbit.y, 2.)) / ol; vec2 ph = ou / ol;
    float hr = max(0., (dot(ph, uHalo) + uTail) / (1. + uTail)) ${front ? '* step(ph.y, 0.)' : ''}; float dd = (ol - 1.) / max(length(og), 1e-4);
    col += (mix(uHE, uHH, hr) * exp(-pow(dd / uHaloShape.x, 2.)) * uHaloShape.z + uHG * exp(-pow(dd / uHaloShape.y, 2.)) * uHaloShape.w) * hr;`;
// the tint wave settles into uTint.z flat steps of colour (0 = smooth)
const tint = 'float tw = .5 + .5 * sin(uTint.y * (3. * lat + 2. * lon) - uWave); if (uTint.z > .5) tw = (floor(tw * uTint.z) + .5) / uTint.z; col = pal(v) * mix(vec3(1.), mix(uTA * 1.4, uTB * 1.4, tw), uTint.x) * sh + uAcc * (haze + rim);';
planetJs = planetJs
  .replace(from.out, ring(false) + ' ' + from.out).replace(from.end, '  ' + ring(true) + '\n' + from.end)
  .replace(from.seed, 'float sd = 0.;') // one noise pattern for every cycle
  .replace(from.eddy, '#define ELAT (-0.32 + uStormLat * sin(uWave + 1.))\nconst float EA = 0.42, EB = 0.22;')
  .replace(from.pal, tint)
  .replace(from.twist, '(1.6 + .2 * tau + uTwist * smoothstep(.45, .9, gE))') // twist acts on the storm's core only
  .replace(from.uni, 'uniform vec3 uL; uniform vec2 uHalo; uniform vec3 uTint; uniform float uWave, uTail, uStormLat; uniform vec4 uOrbit, uHaloShape; uniform vec3 uHE, uHH, uHG, uTA, uTB;');

// [key, label, min, max, step, default] is a slider; [key, label, hex] is a colour
const SPEC = [
  ['Planet', [
    ['px', 'Pixels across the frame', 80, 480, 10, 390], ['disc', 'Planet size (share of the frame)', .25, .46, .01, .33],
    ['az', 'Light direction (degrees)', 0, 360, 1, 89], ['el', 'Light height (degrees)', 0, 60, 1, 19.47]]],
  ['Clouds', [
    ['cloudSpeed', 'Cloud speed (1 = sign-in page)', 0, 6, .1, 1], ['warp', 'Folding of the bands', 0, 3, .05, 2.3], ['vortex', 'Storm spin', 0, 3, .05, .75],
    ['contrast', 'Light against dark', 0, 1.5, .05, 1.2], ['flow', 'Wind along the bands', 0, 3, .05, 1], ['jets', 'Number of bands', 2, 10, 1, 4]]],
  ['Storm (the big dark hole)', [
    ['stormLon', 'Side-to-side swing (radians)', 0, 3, .05, 0], ['stormLat', 'Up-and-down swing (radians)', 0, .4, .01, .05], ['twist', 'Core twist', 0, 2, .05, .55]]],
  ['Colours', [
    ['tintStrength', 'Tint strength', 0, 1, .05, .65], ['tintScale', 'Tint wave size (higher = smaller waves)', .3, 4, .05, .65], ['tintSteps', 'Flat steps of colour (0 = smooth)', 0, 12, 1, 0], ['tintA', 'Tint A', '#9665bd'], ['tintB', 'Tint B', '#dca8a8']]],
  ['Halo', [
    ['haloEdge', 'Outer colour', '#1495e6'], ['haloHot', 'Centre colour', '#f4ecc3'], ['haloGlow', 'Glow colour', '#9ab4de'],
    ['thick', 'Thickness (share of radius)', .005, .1, .005, .03], ['glowWidth', 'Glow width', .03, .4, .01, .1],
    ['bright', 'Brightness', 0, 4, .1, 1], ['glowBright', 'Glow brightness', 0, 2, .05, .25], ['tail', 'Extra tail on each side (degrees)', 0, 90, 1, 18]]],
  ['Orbit', [
    ['tilt', 'Tilt from edge-on (degrees)', 3, 70, 1, 20], ['roll', 'Roll (degrees, left side down)', -45, 45, 1, 22], ['rho', 'Distance (planet radii)', 1, 1.5, .01, 1.32],
    ['orbits', 'Halo turns per loop', .5, 8, .5, 5], ['loop', 'Seconds per loop', 4, 60, 1, 27]]],
];

const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Planet playground</title>
<style>
  :root { color-scheme: dark; --bg: #07080b; --panel: #11131a; --line: #232733; --text: #d9dce4; --dim: #8a90a0; --gold: #ffb338; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.4 system-ui, sans-serif; display: grid; grid-template-columns: minmax(0, 1fr) 360px; height: 100vh; }
  main { display: grid; place-items: center; padding: 16px; min-width: 0; min-height: 0; }
  canvas { width: min(100%, calc(100vh - 32px)); aspect-ratio: 1; image-rendering: pixelated; border-radius: 12px; }
  aside { background: var(--panel); border-left: 1px solid var(--line); overflow-y: auto; padding: 0 16px 24px; }
  .bar { position: sticky; top: 0; background: var(--panel); padding: 14px 0 10px; display: flex; gap: 8px; flex-wrap: wrap; border-bottom: 1px solid var(--line); z-index: 1; }
  button { background: #1b1f2b; color: var(--text); border: 1px solid var(--line); border-radius: 8px; padding: 6px 12px; font: inherit; cursor: pointer; }
  button:hover { border-color: var(--gold); }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: var(--gold); margin: 22px 0 6px; }
  label { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; padding: 5px 0; color: var(--dim); }
  label output { color: var(--text); font-variant-numeric: tabular-nums; }
  label input[type=range] { grid-column: 1 / -1; width: 100%; accent-color: var(--gold); }
  label input[type=color] { width: 44px; height: 24px; padding: 0; border: 1px solid var(--line); background: none; justify-self: end; }
  .none { padding: 40px; text-align: center; color: var(--dim); }
  @media (max-width: 800px) { body { grid-template-columns: 1fr; height: auto; } aside { border-left: 0; border-top: 1px solid var(--line); } canvas { width: 100%; } }
</style></head>
<body><main><canvas id="c"></canvas></main><aside id="panel"></aside>
<script type="module">
const SPEC = __SPEC__;
const P = {}; for (const [, items] of SPEC) for (const it of items) P[it[0]] = it.length === 3 ? it[2] : it[5];
const DEFAULTS = { ...P };
const R = new URLSearchParams(location.search); // ?render=1&frames=N: render.mjs drives the page frame by frame instead of a person
if (R.get('render')) Object.assign(P, await (await fetch('/settings.json')).json());
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const rad = d => d * Math.PI / 180;
let SIZE = P.px, T = 0, paused = false;

// ---- controls ----
const panel = document.getElementById('panel');
const inputs = {};
panel.insertAdjacentHTML('beforeend', '<div class="bar"><button id="pause">Pause</button><button id="reset">Reset</button><button id="copy">Copy settings</button></div>');
for (const [group, items] of SPEC) {
  panel.insertAdjacentHTML('beforeend', '<h2>' + group + '</h2>');
  for (const it of items) {
    const lab = document.createElement('label'), isColor = it.length === 3;
    lab.innerHTML = '<span>' + it[1] + '</span><output></output><input type="' + (isColor ? 'color' : 'range') + '">';
    const inp = lab.querySelector('input'), out = lab.querySelector('output');
    if (!isColor) { inp.min = it[2]; inp.max = it[3]; inp.step = it[4]; } else out.remove();
    const show = () => { inp.value = P[it[0]]; if (!isColor) out.textContent = P[it[0]]; };
    inp.addEventListener('input', () => { P[it[0]] = isColor ? inp.value : +inp.value; show(); if (it[0] === 'px') resizeCanvas(); });
    inputs[it[0]] = show; show(); panel.appendChild(lab);
  }
}
document.getElementById('pause').onclick = e => { paused = !paused; e.target.textContent = paused ? 'Play' : 'Pause'; };
document.getElementById('reset').onclick = () => { Object.assign(P, DEFAULTS); for (const k in inputs) inputs[k](); resizeCanvas(); };
const box = document.createElement('textarea');
box.readOnly = true; box.rows = 12; box.hidden = true; box.style.cssText = 'width:100%;margin-top:16px;background:#0b0d12;color:#d9dce4;border:1px solid #232733;border-radius:8px;font:12px/1.4 ui-monospace,monospace;padding:8px';
panel.appendChild(box);
document.getElementById('copy').onclick = async e => {
  box.value = JSON.stringify(P, null, 2); box.hidden = false; box.focus(); box.select();
  let ok = false;
  try { await navigator.clipboard.writeText(box.value); ok = true; } catch { try { ok = document.execCommand('copy'); } catch {} }
  // browsers can refuse clipboard writes from a page opened as a file; the box is then already selected for Cmd+C
  e.target.textContent = ok ? 'Copied' : 'Press Cmd+C'; box.scrollIntoView({ block: 'nearest' });
  setTimeout(() => e.target.textContent = 'Copy settings', 2500);
};

// ---- the planet: its own code, fed a fake clock so that every real frame is one planet frame ----
__PLANET__

const realRaf = window.requestAnimationFrame.bind(window);
let now = 0, pending = null;
performance.now = () => now;
window.requestAnimationFrame = cb => { pending = cb; return 1; };
const setWindow = () => { for (const k of ['innerWidth', 'innerHeight']) Object.defineProperty(window, k, { value: SIZE * 2, configurable: true }); };
setWindow();

const proto = WebGL2RenderingContext.prototype, names = new Map(), held = {};
const getLoc = proto.getUniformLocation, uniform1f = proto.uniform1f, uniform3f = proto.uniform3f;
proto.getUniformLocation = function (p, n) { const l = getLoc.call(this, p, n); if (l) names.set(l, n); return l; };
const phase = () => 2 * Math.PI * T / P.loop;
proto.uniform1f = function (l, v) {
  const n = names.get(l);
  if (n === 'uTc') v = (held.uTc ??= v) + P.cloudSpeed * T;
  else if (n === 'uEddyLon') v = (held.uEddyLon ??= v) + P.stormLon * Math.sin(phase());
  else if (n === 'uTwist') v = P.twist * Math.sin(phase());
  else if (n === 'uRot') v = (held.uEddyLon ?? 3.3) - 0.5; // the globe holds still, the storm a little right of centre
  else if (n === 'uFrame' || n === 'uGrain') v = 0;
  uniform1f.call(this, l, v);
};
proto.uniform3f = function (l, x, y, z) {
  const n = names.get(l);
  if (n === 'uGeo') { x = SIZE / 2; y = SIZE / 2; z = SIZE * P.disc; }
  else if (n === 'uL') { const a = rad(P.az), e = rad(P.el); x = Math.cos(e) * Math.cos(a); y = Math.cos(e) * Math.sin(a); z = Math.sin(e); }
  uniform3f.call(this, l, x, y, z);
};

const canvas = document.getElementById('c');
const planet = createPlanet(canvas, false);
if (!planet) { document.querySelector('main').innerHTML = '<p class="none">WebGL 2 is not available in this browser, so the planet cannot be drawn.</p>'; throw new Error('no WebGL 2'); }
const gl = canvas.getContext('webgl2');
const L = {}; for (const [l, n] of names) L[n] = l;
for (const n of ['uWarp', 'uVortex', 'uContrast', 'uFlow', 'uJets', 'uHalo', 'uWave', 'uOrbit', 'uHaloShape', 'uTail', 'uHE', 'uHH', 'uHG', 'uTA', 'uTB', 'uTint', 'uStormLat'])
  if (!L[n]) throw new Error('shader input ' + n + ' not found: signInPlanet.ts changed');

function resizeCanvas() { SIZE = P.px; setWindow(); window.dispatchEvent(new Event('resize')); }

function applyInputs() {
  const a = P.orbits * phase() - Math.PI / 2, roll = rad(P.roll), sinTail = Math.sin(rad(P.tail));
  gl.uniform1f(L.uWarp, P.warp); gl.uniform1f(L.uVortex, P.vortex); gl.uniform1f(L.uContrast, P.contrast); gl.uniform1f(L.uFlow, P.flow); gl.uniform1f(L.uJets, P.jets);
  gl.uniform2f(L.uHalo, Math.cos(a), Math.sin(a)); gl.uniform1f(L.uWave, phase());
  gl.uniform4f(L.uOrbit, P.rho, Math.sin(rad(P.tilt)), Math.cos(roll), Math.sin(roll));
  gl.uniform4f(L.uHaloShape, P.thick, P.glowWidth, P.bright, P.glowBright); gl.uniform1f(L.uTail, sinTail);
  gl.uniform3fv(L.uHE, rgb(P.haloEdge)); gl.uniform3fv(L.uHH, rgb(P.haloHot)); gl.uniform3fv(L.uHG, rgb(P.haloGlow));
  gl.uniform3fv(L.uTA, rgb(P.tintA)); gl.uniform3fv(L.uTB, rgb(P.tintB)); gl.uniform3f(L.uTint, P.tintStrength, P.tintScale, P.tintSteps); gl.uniform1f(L.uStormLat, P.stormLat);
}

let last = 0;
function tick(ts) {
  realRaf(tick);
  if (!paused && last) T += Math.min((ts - last) / 1000, 0.1);
  last = ts;
  applyInputs();
  now += 100; const cb = pending; pending = null; cb(now); // 100 ms steps keep the planet's own 24-frames-a-second limiter from skipping frames
}
if (R.get('render')) {
  const post = (path, body) => fetch(path, { method: 'POST', body });
  try {
    // the cloud motion repeats every 13 s of cloud time, so a loop closes only when it spans a whole number of them
    P.cloudSpeed = Math.max(1, Math.round(P.cloudSpeed * P.loop / 13)) * 13 / P.loop;
    const frames = +R.get('frames');
    for (let i = -1; i < frames; i++) { // frame -1 is a throwaway: the planet reports its first-frame clock and storm position while drawing it
      T = P.loop * Math.max(i, 0) / frames; applyInputs();
      now += 100; const cb = pending; pending = null; cb(now);
      if (i >= 0) await post('/frame/' + i, Uint8Array.from(atob(canvas.toDataURL('image/png').split(',')[1]), c => c.charCodeAt(0)));
    }
    await post('/done', '');
  } catch (e) { await post('/error', String(e && e.stack || e)); }
} else realRaf(tick);
</script></body></html>`;

export const buildPage = () => page.replace('__SPEC__', () => JSON.stringify(SPEC)).replace('__PLANET__', () => planetJs);
export const defaults = () => Object.fromEntries(SPEC.flatMap(([, items]) => items.map(it => [it[0], it.length === 3 ? it[2] : it[5]])));
if (process.argv[1] === fileURLToPath(import.meta.url)) { // run directly: write the page
  const out = join(root, 'design/moon-gif/playground.html');
  writeFileSync(out, buildPage());
  console.log(out);
}
