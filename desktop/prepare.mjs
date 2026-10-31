// Copies what the address page shares with the web app's sign-in screen from src/client, so that stays the one source:
// the planet (types stripped, as a plain script) and the Schibsted Grotesk font.
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

const client = new URL('../src/client/', import.meta.url);
const source = await readFile(new URL('signInPlanet.ts', client), 'utf8');
const exported = /^export function createPlanet\(/m;
if (!exported.test(source)) throw new Error('src/client/signInPlanet.ts no longer exports createPlanet; update desktop/prepare.mjs');
const script = stripTypeScriptTypes(source).replace(exported, 'function createPlanet(');
await writeFile(new URL('address/planet.js', import.meta.url), `// Made by desktop/prepare.mjs from src/client/signInPlanet.ts.\n${script}\nwindow.createPlanet = createPlanet;\n`);
await copyFile(new URL('assets/fonts/SchibstedGrotesk-VariableFont_wght.ttf', client), new URL('address/SchibstedGrotesk.ttf', import.meta.url));
