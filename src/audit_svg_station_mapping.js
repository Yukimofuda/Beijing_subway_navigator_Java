const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const svg = fs.readFileSync(path.join(ROOT, 'Beijing_Subway_System_Map.svg'), 'utf8');
const stations = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', '_station.json'), 'utf8'));
const aliases = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'svg_station_aliases.json'), 'utf8'));

function cleanSvgId(id) {
  return String(id || '').replace(/^en_/, '').replace(/-\d+$/, '');
}

const svgStationKeys = Array.from(
  new Set(Array.from(svg.matchAll(/id="(en_[^"]+)"/g)).map((match) => cleanSvgId(match[1])))
).sort((a, b) => a.localeCompare(b));

const stationNames = new Set(Object.keys(stations));
const matched = [];
const unmatched = [];
const badAliases = [];

for (const key of svgStationKeys) {
  const stationName = aliases[key];
  if (!stationName) {
    unmatched.push(key);
  } else if (!stationNames.has(stationName)) {
    badAliases.push({ key, stationName });
  } else {
    matched.push({ key, stationName });
  }
}

console.log(`SVG station label groups: ${svgStationKeys.length}`);
console.log(`Matched aliases: ${matched.length}`);
console.log(`Unmatched aliases: ${unmatched.length}`);
console.log(`Invalid aliases: ${badAliases.length}`);

if (badAliases.length) {
  console.log('\nInvalid alias entries:');
  badAliases.forEach((item) => console.log(`  "${item.key}": "${item.stationName}"`));
}

if (unmatched.length) {
  console.log('\nAdd missing mappings to data/svg_station_aliases.json, for example:');
  unmatched.slice(0, 80).forEach((key) => console.log(`  "${key}": ""`));
  if (unmatched.length > 80) console.log(`  ... and ${unmatched.length - 80} more`);
}
