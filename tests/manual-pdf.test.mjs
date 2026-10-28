// Checks the Typst template for the PDF manual. Needs the typst CLI (see tools/build-manual-pdf.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { typeset } from '../tools/build-manual-pdf.mjs';

const el = (t, c, ...k) => ({ t, c, k });
const svg = { t: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 4 L20 20" stroke="currentColor"/></svg>' };
const logo = { t: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg" class="logo-mark" viewBox="0 0 120 120"><ellipse cx="60" cy="61" rx="12" ry="19" stroke="#d6eef3"/></svg>' };

const manual = (...sections) => el('div', 'manual', el('div', 'mh', logo, el('h1', '', 'Defusal manual')), ...sections);

test('the template typesets every kind of element the manual uses', () => {
  const tree = manual(
    el('div', 'mact no-print', el('button', 'mbtn', 'Open PDF')),
    el('nav', '', el('a', '', 'Wires')),
    el('section', '', el('h2', '', 'Wires'),
      el('p', '', 'Cut ', el('b', '', 'one'), ' wire, ', el('em', '', 'never'), ' two.'),
      el('ul', '', el('li', '', 'a')), el('ol', '', el('li', '', 'b')),
      el('h3', '', 'Rear plate'),
      el('table', 'tbl', el('tbody', '',
        el('tr', '', el('th', '', 'Color'), el('th', '', 'Digit')),
        el('tr', '', el('td', '', el('span', 'chip c-white', 'white')), el('td', 'pat-c', '●', el('br', ''), '○')))),
      el('div', 'gcols', el('div', 'gcol', el('b', '', 'I'), svg)),
      el('div', 'mchart', el('div', '', el('b', '', 'A'), ' ·−')),
      el('div', 'words', el('div', '', 'about')),
      el('div', 'gates', el('div', 'gate', svg, el('b', '', 'AND'), el('span', '', '1 only when both inputs are 1')))),
    el('section', '', el('h2', '', 'Bomb basics'), el('h3', '', 'The case'),
      el('figure', 'schem', { t: 'svg', svg: svg.svg.replace('viewBox', 'width="260" viewBox') }, el('figcaption', '', 'The case unfolded.'))));
  const pdf = typeset(tree, 'abc123');
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
});

test('the template refuses markup it does not know, so nothing in the manual goes missing from the PDF', () => {
  const section = (...k) => manual(el('section', '', el('h2', '', 'Wires'), ...k));
  assert.throws(() => typeset(section(el('blink', '', 'surprise'))), /does not know how to typeset <blink/);
  assert.throws(() => typeset(section(el('div', 'gauge', 'surprise'))), /does not know how to typeset <div class=\\?"gauge\\?">/);
  assert.throws(() => typeset(section(el('p', '', svg))), /only knows the logo, the glyph columns, the gate symbols, the tile grids and schematic figures/);
  assert.throws(() => typeset(el('div', 'manual', el('p', '', 'no cover'))), /expects the manual to open with its logo and title/);
});
