// Drives headless Chrome over the DevTools protocol to save listed.png, empty.png and grabbing.png into <out dir>.
// Run through scripts/screenshots/run.sh, or alone against a running start.sh: node scripts/screenshots/shoot.mjs <out dir>
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2];
const server = `http://127.0.0.1:${process.env.SHOTS_SERVER_PORT ?? 3999}`;
const log = (line) => console.log(`[${new Date().toISOString().slice(11, 23)}] ${line}`);
const pages = await (await fetch(`http://127.0.0.1:${process.env.SHOTS_CHROME_PORT ?? 9333}/json`)).json();
const page = pages.find((entry) => entry.type === 'page');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let nextId = 0;
const waiting = new Map();
socket.onmessage = (message) => {
  const data = JSON.parse(message.data);
  if (data.id !== undefined && waiting.has(data.id)) {
    const { resolve, reject } = waiting.get(data.id);
    waiting.delete(data.id);
    if (data.error) reject(new Error(`${data.error.message}`)); else resolve(data.result);
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  nextId += 1;
  waiting.set(nextId, { resolve, reject });
  socket.send(JSON.stringify({ id: nextId, method, params }));
});
const evaluate = async (expression) => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(`page threw: ${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text}`);
  return result.result.value;
};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const until = async (what, expression, ceiling = 30_000) => {
  const started = Date.now();
  while (Date.now() - started < ceiling) {
    if (await evaluate(expression)) return;
    await pause(200);
  }
  const text = await evaluate('document.body.innerText.slice(0, 1500)');
  throw new Error(`timed out waiting for ${what}; page text:\n${text}`);
};
const shot = async (name) => {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(out, name), Buffer.from(data, 'base64'));
  log(`saved ${name}`);
};
const pickButton = (id) => `document.querySelector('[data-row-key="episode:${id}"] button[aria-label="Pick a release"]')`;
const scrollTo = (id) => evaluate(`(() => { const row = document.querySelector('[data-row-key="episode:${id}"]'); window.scrollTo(0, row.getBoundingClientRect().top + window.scrollY - 140); return true; })()`);
const releaseRows = `document.querySelectorAll('[aria-label="Releases"] [role="row"]').length >= 5`;

await send('Network.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Network.setCookie', { name: 'mm_session', value: 'shotsxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', url: `${server}/` });
log('navigate');
await send('Page.navigate', { url: `${server}/series/5` });

log('wait for episode 208');
await until('the Pick a release button on episode 208', `${pickButton(208)} !== null`);
await evaluate(`${pickButton(208)}.click(), true`);
log('wait for release rows');
await until('five release rows', releaseRows);
await pause(600);
await scrollTo(208);
await pause(300);
const geometry = await evaluate(`(() => {
  const table = document.querySelector('[aria-label="Seasons"]').getBoundingClientRect();
  const x = (element) => Math.round(element.getBoundingClientRect().left - table.left);
  const inset = document.querySelector('[aria-label="Releases"] [role="rowgroup"]');
  const block = inset.firstElementChild;
  const scroll = [...inset.children].find((child) => child.className.includes('overflow-y-auto'));
  const header = document.querySelector('[aria-label="Releases"] [role="row"]');
  return {
    tableWidth: Math.round(table.width),
    blockLeft: x(block), blockWidth: Math.round(block.getBoundingClientRect().width),
    headerCells: [...header.children].map((cell) => [cell.textContent, x(cell), Math.round(cell.getBoundingClientRect().width)]),
    scroll: { clientWidth: scroll.clientWidth, scrollWidth: scroll.scrollWidth, clientHeight: scroll.clientHeight, scrollHeight: scroll.scrollHeight },
    insetHeight: Math.round(inset.getBoundingClientRect().height),
    rows: document.querySelectorAll('[aria-label="Releases"] [role="row"]').length,
  };
})()`);
writeFileSync(join(out, 'run', 'geometry.json'), JSON.stringify(geometry, null, 2));
log(`geometry ${JSON.stringify(geometry)}`);
await shot('listed.png');

log('close 208, open 207');
await evaluate(`${pickButton(208)}.click(), true`);
await pause(400);
await evaluate(`${pickButton(207)}.click(), true`);
await until('the empty state', `document.body.innerText.includes('No release for this episode')`);
await pause(600);
await scrollTo(207);
await pause(300);
await shot('empty.png');

log('close 207, open 208, grab');
await evaluate(`${pickButton(207)}.click(), true`);
await pause(400);
await evaluate(`${pickButton(208)}.click(), true`);
await until('five release rows again', releaseRows);
await pause(600);
await scrollTo(208);
const grabbed = await evaluate(`(() => {
  const button = [...document.querySelectorAll('[aria-label="Releases"] button')].find((item) => item.textContent.trim() === 'Grab' && !item.disabled);
  if (button === undefined) return false;
  button.click();
  return true;
})()`);
if (!grabbed) throw new Error('no enabled Grab button');
await until('the grab dialog', `[...document.querySelectorAll('h2')].some((item) => item.textContent === 'This is already in your library')`);
await pause(400);
await evaluate(`[...document.querySelectorAll('button')].find((item) => item.textContent.includes('Grab and replace the current file')).click(), true`);
await pause(400);
await shot('grabbing.png');
socket.close();
log('done');
