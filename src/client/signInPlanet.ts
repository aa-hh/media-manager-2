// The sign-in planet: a WebGL 2 fragment shader ported from design/discovery/sign-in-generative/2d-jupiter-fluid.html.

type PlanetState = 'idle' | 'checking' | 'success';
type Param = 'az' | 'zoom' | 'order' | 'green';

const V = {
  jets: 4,        // alternating east/west jets from pole to pole (also the number of bands)
  flow: 1.0,      // jet speed multiplier
  warp: 1.0,      // how hard the noise folds and swirls the bands
  vortex: 1.0,    // spin strength of the eddy
  contrast: 0.8,  // light zones against dark belts
  spin: 90,       // seconds per turn of the globe
  grain: 0.05,    // per-pixel film grain
};
const RES = 0.5;      // canvas pixels per CSS pixel, whatever the devicePixelRatio; CSS scales it up
const START = 40;     // cloud clock starts part-way in so the first cycle already has shear
// slate and bone, one cold accent in the air
const STOPS = ['#0b0d13', '#1c2230', '#3a4253', '#6a7079', '#a7a59c', '#e2ddcf'];
const ACCENT = '#93c4d4', LIME = '#c6f135';
// the light: azimuth (0 = right, 90 = up) and elevation toward the viewer. Elevation asin(1/3) leaves a third of the disc in shadow.
const EL = 19.47;
const TARGET: Record<PlanetState, Record<Param, number>> = {
  idle:     { az: 30,  zoom: 1,    order: 0, green: 0 },
  checking: { az: 165, zoom: 1.06, order: 0, green: 0 }, // lit side swings round to face the sign-in block
  success:  { az: 165, zoom: 1.06, order: 1, green: 1 },
};
const DUR: Record<PlanetState, Record<Param, number>> = {
  idle:     { az: 0.7, zoom: 0.7, order: 0.7, green: 0.7 },
  checking: { az: 4,   zoom: 4,   order: 0.6, green: 0.6 },
  success:  { az: 1.7, zoom: 1.7, order: 1.7, green: 1.7 },
};
const DELAY: Partial<Record<Param, number>> = { green: 0.5 }; // the green hairline starts once the bands are mostly straight
const PARAMS: Param[] = ['az', 'zoom', 'order', 'green'];

function mulberry32(a: number) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hex = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const ease = (x: number) => x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

// ---- WebGL 2: all per-pixel work runs in this fragment shader ----
const VS = `#version 300 es
in vec2 p; void main() { gl_Position = vec4(p, 0., 1.); }`;
const FS = `#version 300 es
precision highp float;
precision highp sampler3D;
uniform sampler3D uNoise;   // tiling smooth value noise, 16 features per unit
uniform vec2 uRes;
uniform vec3 uGeo;          // centre x, centre y (from top), radius, canvas pixels
uniform float uTc, uRot, uFrame;
uniform float uJets, uFlow, uWarp, uVortex, uContrast, uGrain;
uniform vec3 uL;            // light direction: x right, y up, z toward the viewer
uniform float uZoom, uOrder, uGreen, uTwist, uEddyLon;
uniform vec3 uPal[6];
uniform vec3 uAcc;
out vec4 o;
const float PI = 3.14159265, TAU = 6.2831853, HALF = 13.;
const vec3 LIME = vec3(${hex(LIME).map(x => x.toFixed(4))});
const float ELAT = -0.32, EA = 0.42, EB = 0.22; // the eddy: latitude, half-width, half-height (radians)

float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float n3(vec3 p) { return texture(uNoise, p).r * 2. - 1.; }
float fbm2(vec3 p) { return .62 * n3(p) + .31 * n3(p * 2.03 + .17); }
float fbm3(vec3 p) { return .55 * n3(p) + .28 * n3(p * 2.03 + .17) + .14 * n3(p * 4.11 + .41); }
vec3 cyl(float lon, float lat, float seed) { return vec3(3. * cos(lon), 3. * sin(lon), 5. * lat + seed) / 16.; }
float bandF(float la) { return cos(uJets * la + .6 * cos(2.3 * la - .57)); }

// one advection phase: tau seconds of jet shear on noise seeded by cycle n
float cloud(float lat, float lon, float tau, float n, float act, out float gE) {
  float chaos = 1. - uOrder;
  // the eddy: rotate the local ellipse frame by an angle that grows toward the core; unwinds as order rises
  float dx = mod(lon - uEddyLon + PI, TAU) - PI, cl = max(.05, cos(lat));
  vec2 e = vec2(dx * cl / EA, (lat - ELAT) / EB);
  gE = exp(-dot(e, e));
  float th = uVortex * gE * (1.6 + .2 * tau + uTwist) * chaos;
  e = mat2(cos(th), sin(th), -sin(th), cos(th)) * e;
  lon = uEddyLon + e.x * EA / cl; lat = ELAT + e.y * EB;
  // jets: alternating zonal winds shear the noise; they lock together (zero shear) as order rises
  float u = .03 * uFlow * sin(uJets * lat + .5 * sin(2.3 * lat)) * (.6 + .4 * cl) * (.35 + .65 * act);
  lon -= u * tau * (1. - gE) * chaos;
  float sd = n * .4456;
  vec3 p = cyl(lon, lat, sd);
  float w = uWarp * chaos;
  float qx = fbm2(p), qy = fbm2(p + vec3(.33, 0., .08));
  float nn = fbm3(cyl(lon + w * qx * .25, lat + w * qy * .09, sd * 1.15 + .19));
  float latW = lat + w * .06 * (qx + nn);
  float brk = mix(clamp(.35 + 2. * qx, 0., 1.), 1., uOrder);  // bands break off along longitude
  float turb = (.25 + .75 * act) * chaos;
  return .5 + .55 * uContrast * bandF(latW) * mix(.3 + .7 * act, 1., .4 * uOrder) * brk + .3 * nn * turb + .08 * qy * chaos;
}

vec3 pal(float v) {
  v = clamp(v, 0., 1.) * 5.;
  float i = min(floor(v), 4.), f = smoothstep(0., 1., v - i);
  vec3 a = uPal[0], b = uPal[1];
  if (i > 3.5) { a = uPal[4]; b = uPal[5]; } else if (i > 2.5) { a = uPal[3]; b = uPal[4]; }
  else if (i > 1.5) { a = uPal[2]; b = uPal[3]; } else if (i > .5) { a = uPal[1]; b = uPal[2]; }
  return mix(a, b, f);
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  float rad = uGeo.z * uZoom;
  vec2 q = (fc - vec2(uGeo.x, uRes.y - uGeo.y)) / rad;
  float r = length(q);
  float hs = hash(fc);
  float dith = (hash(fc + fract(uFrame * .6180339) * 241.) - .5);
  vec3 col = vec3(7., 8., 11.) / 255. + (hs > .9992 ? (30. + 110. * hash(fc.yx)) / 255. * vec3(.9, .95, 1.) : vec3(0.));
  vec2 l2 = normalize(uL.xy + 1e-5);
  if (r >= 1.) {
    // thin halo just outside the disc, brighter on the lit side
    float f = max(0., dot(q / r, l2)) * .85 + .15;
    col += uAcc * exp(-(r - 1.) * 30.) * f * .27;
    o = vec4(col + dith / 255., 1.); return;
  }
  float nz = sqrt(1. - r * r);
  vec3 n = vec3(q, nz);
  // body frame: a little roll and pitch, then latitude/longitude
  const float cr = .98007, sr = .19867, cp = .98723, sp = .15932;
  float xa = q.x * cr + q.y * sr, ya = -q.x * sr + q.y * cr, yb = ya * cp - nz * sp, zb = ya * sp + nz * cp;
  float lat = asin(clamp(yb, -1., 1.)), lon = atan(xa, zb) + uRot;
  float act = smoothstep(-.3, .3, .55 * sin(lat * 2.6 + .9) + .45 * sin(lat * 4.1 - .4) + .1); // 0 = almost calm latitude
  // two advection cycles, offset by half a cycle, cross-fade so the shear never runs away
  float n1 = floor(uTc / HALF), tau1 = uTc - n1 * HALF, w1 = tau1 / HALF, g0, g1;
  float v = (1. - w1) * cloud(lat, lon, tau1 + HALF, n1 - 1., act, g0) + w1 * cloud(lat, lon, tau1, n1, act, g1);
  // ordered state: clean evenly spaced parallels, lined up with the bands
  v += uOrder * (.17 * pow(.5 + .5 * cos(uJets * 3. * lat), 40.) - .05);
  // the eddy: a sunken dark core with a faint pale collar; a smooth oval remains once ordered
  float core = smoothstep(.3, .85, g0), collar = smoothstep(.07, .22, g0) * (1. - smoothstep(.22, .42, g0));
  v = mix(v, .07 + .3 * (v - .5), core * (1. - .6 * uOrder)) + .12 * collar * (1. - uOrder);
  v = mix(v, .32 + .3 * (v - .5), smoothstep(.95, 1.4, abs(lat))); // polar hoods
  // shading: a third of the disc in night; the day/night edge and the limb sharpen as order rises
  float d = dot(n, uL);
  float aa = 1.2 / rad;
  float edge = smoothstep(1., 1. - mix(.015, aa, uOrder), r);
  float sh = (.012 + 1.04 * smoothstep(mix(-.1, -.02, uOrder), mix(.72, .5, uOrder), d)) * edge * (.5 + .5 * pow(nz, .45));
  float haze = pow(1. - nz, 2.5) * .37 * max(0., d + .15);
  float rim = smoothstep(mix(.95, .985, uOrder), .997, r) * .59 * (.22 + .9 * smoothstep(-.35, .45, d)) * edge;
  col = pal(v) * sh + uAcc * (haze + rim);
  col += (hash(fc * 1.37 + fract(uFrame * .7548776) * 173.) - .5) * uGrain;
  // success: the only green is a faint edge on the lit limb
  float limbG = smoothstep(1. - 2. * aa, 1. - aa * .3, r) * max(0., dot(q / r, l2)) * .3;
  col = mix(col, LIME, uGreen * limbG);
  o = vec4(col + dith / 255., 1.);
}`;

export function createPlanet(canvas: HTMLCanvasElement, reducedMotion: boolean): { setState(state: PlanetState): void; destroy(): void } | undefined {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) {
    console.warn('WebGL 2 unavailable: the planet is not drawn'); // razor: no Canvas 2D fallback
    return undefined;
  }
  const U: Record<string, WebGLUniformLocation | null> = {};
  function sh(type: number, src: string) { const s = gl!.createShader(type)!; gl!.shaderSource(s, src); gl!.compileShader(s); if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) throw new Error(gl!.getShaderInfoLog(s) ?? 'shader compile failed'); return s; }
  try {
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr) ?? 'program link failed');
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    for (let i = 0, nu = gl.getProgramParameter(pr, gl.ACTIVE_UNIFORMS) as number; i < nu; i++) { const nm = gl.getActiveUniform(pr, i)!.name.replace('[0]', ''); U[nm] = gl.getUniformLocation(pr, nm); }
  } catch (error) {
    console.warn('The sign-in planet shader failed to build: the planet is not drawn', error);
    return undefined;
  }
  // noise volume: 64^3 texels, smooth (quintic) interpolation of a 16^3 random lattice, wraps on every axis
  const S = 64, L = 16, rnd = mulberry32(11), lat = new Float32Array(L * L * L).map(() => rnd()), vol = new Uint8Array(S * S * S);
  const f = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);
  for (let z = 0, k = 0; z < S; z++) for (let y = 0; y < S; y++) for (let x = 0; x < S; x++, k++) {
    const gx = x * L / S, gy = y * L / S, gz = z * L / S, x0 = gx | 0, y0 = gy | 0, z0 = gz | 0;
    const u = f(gx - x0), v = f(gy - y0), w = f(gz - z0), x1 = (x0 + 1) % L, y1 = (y0 + 1) % L, z1 = (z0 + 1) % L;
    const at = (a: number, b: number, c: number) => lat[(c * L + b) * L + a];
    const m = (a: number, b: number, t: number) => a + (b - a) * t;
    vol[k] = 255 * m(m(m(at(x0, y0, z0), at(x1, y0, z0), u), m(at(x0, y1, z0), at(x1, y1, z0), u), v),
                     m(m(at(x0, y0, z1), at(x1, y0, z1), u), m(at(x0, y1, z1), at(x1, y1, z1), u), v), w);
  }
  gl.bindTexture(gl.TEXTURE_3D, gl.createTexture());
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8, S, S, S, 0, gl.RED, gl.UNSIGNED_BYTE, vol);
  for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_3D, p, gl.LINEAR);
  for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, p, gl.REPEAT);
  gl.uniform1i(U.uNoise, 0);

  gl.uniform3fv(U.uPal, STOPS.flatMap(hex));
  gl.uniform3fv(U.uAcc, hex(ACCENT));
  gl.uniform1f(U.uJets, V.jets); gl.uniform1f(U.uFlow, V.flow); gl.uniform1f(U.uWarp, V.warp);
  gl.uniform1f(U.uVortex, V.vortex); gl.uniform1f(U.uContrast, V.contrast); gl.uniform1f(U.uGrain, V.grain);

  let narrow = false;
  function resize() {
    const W = Math.max(1, Math.round(innerWidth * RES)), H = Math.max(1, Math.round(innerHeight * RES));
    canvas.width = W; canvas.height = H;
    narrow = innerWidth < 640;
    gl!.viewport(0, 0, W, H);
    gl!.uniform2f(U.uRes, W, H);
    gl!.uniform3f(U.uGeo, narrow ? W * 0.62 : W * 0.76, narrow ? H * 0.3 : H * 0.5, narrow ? Math.min(W, H) * 0.62 : Math.min(H * 0.66, W * 0.38));
  }

  // ---- states: each parameter tweens from wherever it is to the new state's target ----
  const tw = {} as Record<Param, { from: number; to: number; t0: number; dur: number }>;
  for (const k of PARAMS) tw[k] = { from: TARGET.idle[k], to: TARGET.idle[k], t0: 0, dur: 1 };
  const pv = (k: Param, t: number) => { const p = tw[k]; return p.from + (p.to - p.from) * ease((t - p.t0) / p.dur); };
  // on a phone the sign-in block sits below the planet, so the light swings down-left instead of left
  const target = (s: PlanetState, k: Param) => k === 'az' && s !== 'idle' && narrow ? 235 : TARGET[s][k];
  let state: PlanetState = 'idle', tCheck: number | null = null, lastChange = -99, curT = 0;

  // ---- frame: the CPU only sets a few uniforms ----
  let frameNo = 0;
  function frame(t: number) {
    curT = t;
    const tc = START + t;
    // the eddy quickens while waiting: extra twist accumulates from the moment checking starts
    const twist = tCheck === null ? 0 : 0.12 * Math.min(Math.max(0, t - tCheck), 40);
    const az = pv('az', t) * Math.PI / 180, el = EL * Math.PI / 180;
    gl!.uniform3f(U.uL, Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el));
    gl!.uniform1f(U.uZoom, pv('zoom', t)); gl!.uniform1f(U.uOrder, pv('order', t)); gl!.uniform1f(U.uGreen, pv('green', t));
    gl!.uniform1f(U.uTwist, twist); gl!.uniform1f(U.uTc, tc);
    gl!.uniform1f(U.uRot, ((tc / V.spin) % 1) * 2 * Math.PI);
    gl!.uniform1f(U.uEddyLon, 3.3 - 0.002 * tc * V.flow);
    gl!.uniform1f(U.uFrame, frameNo++);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
  }

  let raf = 0, T0real = 0, tBase = 0, lastDraw = -1e9;
  const STEP = 1000 / 24;
  function loop(now: number) {
    raf = requestAnimationFrame(loop);
    const t = tBase + (now - T0real) / 1000;
    // razor: 24 fps fixed step while idle or checking (a 90 s turn and slow drift); full rate through the success transition and 1 s after any state change
    const fast = t - lastChange < (state === 'success' ? 1.7 + (DELAY.green ?? 0) + 1 : 1);
    if (!fast) { if (now - lastDraw < STEP) return; lastDraw = now - Math.min((now - lastDraw) % STEP, STEP / 2); }
    else lastDraw = now;
    frame(t);
  }
  function start() { if (!raf) { T0real = performance.now(); tBase = curT; raf = requestAnimationFrame(loop); } }
  function stop() { cancelAnimationFrame(raf); raf = 0; }

  const onVisibility = () => { if (reducedMotion) return; if (document.hidden) stop(); else start(); };
  const onResize = () => { resize(); if (reducedMotion) frame(curT); };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('resize', onResize);

  // ---- boot ----
  resize();
  if (reducedMotion) frame(0);
  else start();

  return {
    setState(s) {
      if (s === state) return;
      const t = curT, instant = reducedMotion;
      for (const k of PARAMS) {
        const p = tw[k], dl = s === 'success' ? DELAY[k] ?? 0 : 0;
        p.from = instant ? target(s, k) : pv(k, t); p.to = target(s, k); p.t0 = t + (instant ? 0 : dl); p.dur = instant ? 1e-6 : DUR[s][k];
      }
      if (s === 'checking' && tCheck === null) tCheck = t;
      state = s; lastChange = t;
      if (reducedMotion) frame(curT);
    },
    destroy() {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
