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

function createClassList() {
  const values = new Set();
  return { add: (v) => values.add(v), remove: (v) => values.delete(v), contains: (v) => values.has(v) };
}

function createElement() {
  const listeners = {};
  return {
    value: '',
    hidden: false,
    innerHTML: '',
    dataset: {},
    classList: createClassList(),
    addEventListener(type, callback) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(callback);
    },
    dispatchEvent(event) {
      for (const callback of listeners[event.type] || []) callback(event);
    },
    contains() { return false; },
    get listeners() { return listeners; }
  };
}

function createOption(kind, value) {
  return {
    dataset: kind === 'station' ? { kind, value, station: value } : { kind, value },
    closest() { return this; }
  };
}

function optionValues(html, kind = 'station') {
  const re = new RegExp(`data-kind="${kind}"[^>]*data-value="([^"]+)"`, 'g');
  return Array.from(html.matchAll(re)).map((match) => match[1]);
}

function CustomEvent(type, init = {}) {
  return { type, detail: init.detail };
}

const context = vm.createContext({ console, window: {}, document: { addEventListener() {} }, CustomEvent });
context.window = context;
context.globalThis = context;
context.CustomEvent = CustomEvent;
runScript(context, 'src/transitData.js');
const TransitData = context.TransitData;

const stations = readJson('data/_station.json');
const timetable = { ...readJson('data/timetable.workday.json'), ...readJson('data/timetable.weekend.json') };
const pinyinMap = readJson('data/station_pinyin.json');
const allStations = Object.keys(stations);
const index = TransitData.buildLineIndex(stations, timetable, { pinyinMap });

assert.strictEqual(index.stations.length, allStations.length, 'buildLineIndex must not drop stations');
assert.strictEqual(TransitData.buildLineIndex(stations, timetable, { pinyinMap }).stations.length, index.stations.length, 'query and station guide should share same index result');

const input = createElement();
const menu = createElement();
const lineSelect = createElement();
const lineSummary = createElement();
let stationChangeCount = 0;
input.addEventListener('stationchange', () => { stationChangeCount += 1; });

const picker = TransitData.createStationPicker(index, stations, {
  input,
  menu,
  lineSelect,
  lineSummary,
  openShowsAll: true,
  clearStationOnLineChange: true,
  autoSelectFirstStation: false
});

input.value = '西直门';
input.dispatchEvent({ type: 'focus' });
const openHtml = menu.innerHTML;
assert(openHtml.includes('西直门'), 'open menu should include current station');
assert(openHtml.includes('积水潭') || openHtml.includes('北京南站'), 'open menu should show more stations than current input');
assert(optionValues(openHtml).length > 20, 'open menu should show full station list, not keyword-only results');

input.value = '12';
input.dispatchEvent({ type: 'input' });
const lineCandidates = optionValues(menu.innerHTML, 'line');
assert(lineCandidates.includes('12号线'), 'typing 12 should show 12号线 line candidate');

input.value = '蓟门';
input.dispatchEvent({ type: 'input' });
if (stations['蓟门桥']) {
  assert(optionValues(menu.innerHTML).includes('蓟门桥'), 'typing 蓟门 should show 蓟门桥');
} else {
  console.warn('SKIP: data/_station.json does not contain 蓟门桥, cannot assert 蓟门 match');
}

input.value = 'xzm';
input.dispatchEvent({ type: 'input' });
assert(optionValues(menu.innerHTML).includes('西直门'), 'typing xzm should show 西直门 when pinyin seed exists');

input.value = '12';
input.dispatchEvent({ type: 'input' });
menu.listeners.click[0]({ target: createOption('line', '12号线') });
assert(!input.dataset.station, 'choosing a line must not set dataset.station');
assert(!stations[input.value], 'choosing a line must not write a station into input.value');
assert.strictEqual(stationChangeCount, 0, 'choosing a line must not dispatch stationchange');

const line = index.lineMap.get('12号线');
if (line && line.stations.length) {
  const menuStations = optionValues(menu.innerHTML, 'station');
  assert.strictEqual(menuStations.length, line.stations.length, 'line menu should show all stations without slicing');
  assert.deepStrictEqual(menuStations, line.stations, 'line menu station order should match index line order');
}

const firstStation = line?.stations?.[0] || index.stations[0];
menu.listeners.click[0]({ target: createOption('station', firstStation) });
assert.strictEqual(picker.resolve(), firstStation, 'clicking station should select station');
assert.strictEqual(stationChangeCount, 1, 'clicking station should dispatch stationchange once');

console.log('PASS: station picker behavior audit');
