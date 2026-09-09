const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const svg = fs.readFileSync(path.join(root, 'Beijing_Subway_System_Map.svg'), 'utf8');
const stations = JSON.parse(fs.readFileSync(path.join(root, 'data/_station.json'), 'utf8'));
const review = JSON.parse(fs.readFileSync(path.join(root, 'data/svg_station_mapping_review.json'), 'utf8'));
const hash = (text) => crypto.createHash('sha256').update(text).digest('hex');
assert.strictEqual(hash(svg), review.source_svg.sha256, 'SVG changed; re-audit label identities before release');

const documentRoot = { name: 'document', children: [] };
const stack = [documentRoot];
const ids = new Map();
for (const token of svg.matchAll(/<([^>]+)>/g)) {
  const markup = token[1];
  if (/^[!?]/.test(markup)) continue;
  if (markup.startsWith('/')) {
    assert.strictEqual(stack.pop().name, markup.slice(1).trim(), 'Unbalanced SVG element');
    continue;
  }
  const name = markup.match(/^[\w:-]+/)[0];
  const attributes = Object.fromEntries(Array.from(markup.matchAll(/([\w:-]+)="([^"]*)"/g), (match) => [match[1], match[2]]));
  const element = { name, attributes, children: [] };
  stack[stack.length - 1].children.push(element);
  if (attributes.id) {
    assert(!ids.has(attributes.id), 'Duplicate SVG id: ' + attributes.id);
    ids.set(attributes.id, element);
  }
  if (!markup.endsWith('/')) stack.push(element);
}
assert.strictEqual(stack.length, 1);

function select(selector) {
  const match = selector.match(/^#([^ >]+)(?: > :nth-child\((\d+)\))?$/);
  assert(match, 'Unexpected evidence selector: ' + selector);
  const parent = ids.get(match[1]);
  return match[2] ? parent?.children[Number(match[2]) - 1] : parent;
}

function geometry(element) {
  return element.name === 'path'
    ? [element.attributes.d || '']
    : element.children.flatMap(geometry);
}

const identities = new Map();
function verifyLabel(record) {
  const elements = record.label_selectors.map(select);
  assert(elements.length && elements.every(Boolean), 'Missing actual SVG elements: ' + record.station);
  for (const element of elements) {
    assert(!identities.has(element), 'Two stations share a label: ' + record.station);
    identities.set(element, record.station);
  }
  assert.strictEqual(hash(elements.flatMap(geometry).join('\n')), record.path_geometry_sha256, 'Wrong glyphs: ' + record.station);
  if (record.exact_background_selectors?.length) {
    const backgrounds = record.exact_background_selectors.map(select);
    assert(backgrounds.every(Boolean), 'Missing verified white outline: ' + record.station);
    assert.strictEqual(hash(backgrounds.flatMap(geometry).join('\n')), record.path_geometry_sha256);
  }
}

const registry = new Map(review.station_review.map((record) => [record.station, record]));
assert.strictEqual(registry.size, review.station_review.length, 'Duplicate canonical station');
assert.deepStrictEqual([...registry.keys()].sort(), Object.keys(stations).sort(), 'Evidence must cover every registry entry');
const located = review.station_review.filter((record) => record.exists_in_source_svg);
const missing = review.station_review.filter((record) => !record.exists_in_source_svg);
located.forEach(verifyLabel);
for (const record of missing) assert.strictEqual(record.label_selectors?.length || 0, 0, 'Do not invent positions');
review.source_labels_outside_registry.forEach((record) => {
  assert(!stations[record.station], 'Source-only station impersonates registry station');
  verifyLabel(record);
});
assert.strictEqual(located.length, 402);
assert.deepStrictEqual(missing.map((record) => record.station).sort(), ['南八里庄', '红庙']);

const corrected = { '玉渊潭东门': '#en_Muxidi-4', '嘉会湖': '#en_Ciqu-8', '大兴机场': '#en_Hualikan-9', '环球度假区': '#en_US-2', '新首钢': '#en_Sidaoqiao-6', '沙河高教园': '#en_SUP-2' };
for (const [station, selector] of Object.entries(corrected)) assert(registry.get(station).label_selectors.includes(selector), 'Incorrect binding: ' + station);

console.table({ registry: { count: registry.size }, verifiedPhysicalLabels: { count: located.length }, missingSourcePositions: { count: missing.length }, sourceOnlyStations: { count: review.source_labels_outside_registry.length } });
console.log('PASS: exact selectors, glyph fingerprints, unique bindings and source version verified.');
console.warn('NOT 404 on-map positions: original artwork lacks 南八里庄、红庙. No coordinates fabricated.');

async function auditBrowserIntegrity() {
  const code = fs.readFileSync(path.join(root, 'src/sourceIntegrity.js'), 'utf8');
  for (const nativeCrypto of [undefined, crypto.webcrypto]) {
    const context = vm.createContext({ TextEncoder, crypto: nativeCrypto });
    vm.runInContext(code, context);
    for (const sample of ['', 'abc', '北京地铁', 'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(64), svg]) {
      assert.strictEqual(await context.SourceIntegrity.sha256(sample), hash(sample), 'Native/HTTP-LAN integrity verification mismatch');
    }
  }
  console.log('PASS: map source integrity in HTTPS and HTTP LAN environments');
}

auditBrowserIntegrity().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
