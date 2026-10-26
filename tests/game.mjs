// Loads the game's script into a sandbox (no browser needed) so its logic can be tested directly.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const siteDir = path.resolve(here, '..', 'site');
export const indexFile = path.join(siteDir, 'index.html');
export const BOOT = '/* =====================================================================\n   7. BOOT';
export const EXPORTS = 'Modules, DIFFICULTIES, makeBomb, pickModules, rng, planCase, layoutFor, ensureNeeds, manualHTML, manualFingerprint, wireAnswer, WIRE_RULES, BTN_RULES, TOGGLE_RULES, MEM_TABLE, KNOB_TABLE, KNOB_DIRS, COMBO_RULES, FUSE_CIRCUITS, FUSE_AMPS, FUSE_RULES, fuseCircuit, breakerWantUp, MORSE_CHANNELS, WORDS, seedFrom, randomSeed, settings, DEFAULTS, sfx, music, fmt';

export function scriptSource(html = fs.readFileSync(indexFile, 'utf8')) {
  const m = html.match(/<script>([\s\S]*)<\/script>/);          // the game script is the only attribute-less <script>
  if (!m) throw new Error('game script not found in index.html');
  return m[1];
}

export function loadGame({ AudioContext } = {}) {
  const src = scriptSource(), cut = src.indexOf(BOOT);
  if (cut < 0) throw new Error('boot marker not found: the section comments in the script changed');
  const el = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, append() {}, setAttribute() {}, addEventListener() {} });
  const sandbox = {
    document: { getElementById: () => null, createElement: el, createTextNode: t => t, querySelector: () => null, querySelectorAll: () => [], addEventListener() {},
      body: { append() {}, classList: { add() {}, remove() {}, contains: () => false } } },
    window: { AudioContext }, location: { search: '' }, URLSearchParams, performance, console,
    setTimeout, clearTimeout, setInterval, clearInterval, requestAnimationFrame: () => 0, cancelAnimationFrame() {}
  };
  vm.createContext(sandbox);
  vm.runInContext(src.slice(0, cut) + `\nglobalThis.__t = { ${EXPORTS} };\n})();`, sandbox);
  return sandbox.__t;
}
