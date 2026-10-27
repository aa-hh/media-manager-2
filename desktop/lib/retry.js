'use strict';
// What to do when mpv fails (network §2.5, recommendation 5). No Electron
// here, so tests/production.test.mjs can run it.

// Most direct first. Each step down is a new load at the current position.
const PLANS = [
  { directPlay: true, directStream: true, directStreamAudio: true, label: 'Direct play' },
  { directPlay: false, directStream: true, directStreamAudio: true, label: 'Direct stream' },
  { directPlay: false, directStream: false, directStreamAudio: true, label: 'Transcode' },
  { directPlay: false, directStream: false, directStreamAudio: false, label: 'Transcode, audio included' },
];

// A run of failures with no playback in between gets this many fresh loads of the same plan.
const TOKEN_RELOADS = 2;
const SAME_PLAN_RELOADS = 3;

const planIndex = (flags) => (flags.directPlay ? 0 : flags.directStream ? 1 : flags.directStreamAudio ? 2 : 3);

/**
 * `failure` is 'unauthorized' (Plex answered 401: the transient token ran out)
 * or 'failed' (any other error, or the stream ending early). `played` says the
 * failing plan had already played, so the plan works and the network or a
 * conversion broke. `tries` counts fresh loads since playback last moved:
 * `{ token, same }`.
 * Returns `{ kind: 'reload' }` (a fresh load of the same plan, which also gets
 * a fresh token), `{ kind: 'step', flags }` (the next plan down, keeping a
 * picked quality) or `{ kind: 'give-up' }` after the last plan.
 */
const nextStep = (flags, failure, played, tries) => {
  if (failure === 'unauthorized' && tries.token < TOKEN_RELOADS) return { kind: 'reload', count: 'token' };
  if (played && tries.same < SAME_PLAN_RELOADS) return { kind: 'reload', count: 'same' };
  // A transcode that never played gets one reload before stepping down.
  if (!played && !flags.directPlay && tries.same < 1) return { kind: 'reload', count: 'same' };
  const index = planIndex(flags);
  if (index === PLANS.length - 1) return { kind: 'give-up' };
  const { label, ...next } = PLANS[index + 1];
  return { kind: 'step', flags: { ...flags, ...next } };
};

const planLabel = (flags) => PLANS[planIndex(flags)].label;

module.exports = { nextStep, planLabel, TOKEN_RELOADS, SAME_PLAN_RELOADS };
