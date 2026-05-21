const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function runScript(context, filename) {
  const code = fs.readFileSync(path.join(ROOT, filename), 'utf8');
  vm.runInContext(code, context, { filename });
}

function collectTimetableStations(timetable) {
  const stations = new Set();
  const byLine = new Map();
  for (const dayKey of Object.keys(timetable || {})) {
    const day = timetable[dayKey] || {};
    for (const line of Object.keys(day)) {
      if (!byLine.has(line)) byLine.set(line, new Set());
      for (const direction of Object.keys(day[line] || {})) {
        for (const trainNo of Object.keys(day[line][direction] || {})) {
          const schedule = day[line][direction][trainNo];
          if (!Array.isArray(schedule)) continue;
          for (const stop of schedule) {
            if (!stop?.[0]) continue;
            stations.add(stop[0]);
            byLine.get(line).add(stop[0]);
          }
        }
      }
    }
  }
  return { stations, byLine };
}

function collectStationJsonLines(stations, TransitData) {
  const byLine = new Map();
  for (const [stationName, info] of Object.entries(stations || {})) {
    for (const rawLine of info.lines || []) {
      const label = TransitData.simplifyLineName(rawLine);
      if (!byLine.has(label)) byLine.set(label, new Set());
      byLine.get(label).add(stationName);
    }
  }
  return byLine;
}

const context = vm.createContext({ console, window: {} });
context.window = context;
context.globalThis = context;
runScript(context, 'src/transitData.js');
const TransitData = context.TransitData;

const stations = readJson('data/_station.json');
const workday = readJson('data/timetable.workday.json');
const weekend = readJson('data/timetable.weekend.json');
const mergedTimetable = { ...workday, ...weekend };
const index = TransitData.buildLineIndex(stations, mergedTimetable);

const stationNames = Object.keys(stations);
const stationSet = new Set(stationNames);
const workdayStations = collectTimetableStations(workday);
const weekendStations = collectTimetableStations(weekend);
const mergedStations = collectTimetableStations(mergedTimetable);
const stationJsonLines = collectStationJsonLines(stations, TransitData);

const indexStationSet = index.stationSet || new Set(index.stations || []);
const missingFromIndex = stationNames.filter((name) => !indexStationSet.has(name));
const timetableNotInStationJson = Array.from(mergedStations.stations).filter((name) => !stationSet.has(name)).sort((a, b) => a.localeCompare(b, 'zh-CN'));

console.log(`_station.json stations: ${stationNames.length}`);
console.log(`workday timetable stations: ${workdayStations.stations.size}`);
console.log(`weekend timetable stations: ${weekendStations.stations.size}`);
console.log(`TransitData index stations: ${index.stations.length}`);
console.log(`index equals _station.json: ${missingFromIndex.length === 0 && index.stations.length === stationNames.length}`);
console.log(`missing from index: ${missingFromIndex.length ? missingFromIndex.join(', ') : 'none'}`);
console.log(`timetable stations not in _station.json: ${timetableNotInStationJson.length ? timetableNotInStationJson.join(', ') : 'none'}`);

const lineRows = [];
const lineLabels = new Set([
  ...Array.from(stationJsonLines.keys()),
  ...Array.from(index.lineMap.keys())
]);
for (const label of Array.from(lineLabels).sort(TransitData.compareLines)) {
  const fromStationJson = stationJsonLines.get(label) || new Set();
  const line = index.lineMap.get(label);
  const indexLineSet = line?.stationSet || new Set(line?.stations || []);
  const timetableSet = new Set();
  for (const [rawLine, set] of mergedStations.byLine.entries()) {
    if (TransitData.simplifyLineName(rawLine) === label) {
      for (const stationName of set) timetableSet.add(stationName);
    }
  }
  const missing = Array.from(fromStationJson).filter((name) => !indexLineSet.has(name));
  lineRows.push({
    line: label,
    stationJson: fromStationJson.size,
    timetable: timetableSet.size,
    index: indexLineSet.size,
    missing: missing.join(' / ')
  });
}
console.table(lineRows);

assert.strictEqual(index.stations.length, stationNames.length, 'index.stations length must equal _station.json station count');
if (missingFromIndex.length) {
  console.error('Index missing stations:', missingFromIndex);
  process.exit(1);
}
console.log('PASS: station data consistency audit');
