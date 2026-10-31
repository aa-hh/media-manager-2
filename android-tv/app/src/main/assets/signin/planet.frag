#version 300 es
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
const vec3 LIME = vec3(0.7765,0.9451,0.2078);
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
}
