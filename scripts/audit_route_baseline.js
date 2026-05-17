const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const CASES = [
  ['西直门', '积水潭'],
  ['西直门', '北京南站'],
  ['国贸', '西二旗'],
  ['宋家庄', '东直门'],
  ['海淀黄庄', '蓟门桥'],
];

function createElement(tag = 'div') {
  return {
    tagName: tag.toUpperCase(),
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() { return false; },
    },
    style: {},
    textContent: '',
    innerHTML: '',
    value: '',
    dataset: {},
    disabled: false,
    hidden: false,
    children: [],
    appendChild(child) {
      this.children.push(child);
      this.innerHTML += child.textContent || '';
      return child;
    },
    addEventListener() {},
    contains(target) {
      return target === this || this.children.includes(target);
    },
    setAttribute() {},
  };
}

function createDom(ids) {
  const nodes = new Map();
  ids.forEach((id) => nodes.set(id, createElement('div')));
  return {
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, createElement('div'));
      return nodes.get(id);
    },
    createElement,
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener(event, callback) {
      if (event === 'DOMContentLoaded') callback();
    },
  };
}

function runScript(filename, context) {
  const code = fs.readFileSync(path.join(ROOT, filename), 'utf8');
  vm.runInContext(code, context, { filename });
}

function loadJson(file) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
}

function routeTime(route) {
  return Number(route?.time ?? route?.totalTime ?? route?.distance);
}

function runCase(context, stationData, start, end) {
  if (!stationData[start] || !stationData[end]) {
    return { start, end, skipped: true, reason: 'station missing' };
  }

  const shortest = context.dijkstraShortestPath(start, end);
  const least = context.dijkstraLeastTransfers(start, end);

  if (!shortest || !least) {
    return { start, end, skipped: true, reason: 'no route' };
  }

  const shortestTime = routeTime(shortest);
  const leastTransferTime = routeTime(least);

  return {
    start,
    end,
    shortestPath: shortest.path,
    shortestTime,
    leastTransferPath: least.path,
    leastTransferTime,
    leastTransfers: least.transfers,
    ok: shortestTime <= leastTransferTime,
  };
}

async function createQueryContext(timetable, stationData) {
  const document = createDom([
    'query-button',
    'data-status',
    'current-time',
    'result',
    'start-station',
    'end-station',
    'start-station-menu',
    'end-station-menu',
    'start-line-select',
    'end-line-select',
    'start-line-summary',
    'end-line-summary',
  ]);

  const context = vm.createContext({
    document,
    window: null,
    loadTimetableData: async () => timetable,
    fetch: async (url) => {
      if (url === 'data/_station.json') return { ok: true, json: async () => stationData };
      return { ok: false, status: 404, json: async () => ({}) };
    },
    console: { log() {}, warn() {}, error() {} },
    setInterval: () => 0,
    clearInterval() {},
    setTimeout,
    clearTimeout,
    parseInt,
    isNaN,
    Math,
    Date,
    URLSearchParams,
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    alert() {},
  });
  context.window = context;
  context.globalThis = context;
  context.showToast = function showToast() {};
  context.location = { search: '' };

  runScript('src/transitData.js', context);
  runScript('src/query.js', context);
  await new Promise((resolve) => setTimeout(resolve, 120));
  return context;
}

async function main() {
  const workday = loadJson('data/timetable.workday.json');
  const weekend = loadJson('data/timetable.weekend.json');
  const timetable = { ...workday, ...weekend };
  const stationData = loadJson('data/_station.json');
  const context = await createQueryContext(timetable, stationData);

  const rows = CASES.map(([start, end]) => runCase(context, stationData, start, end));
  console.table(rows.map((row) => ({
    start: row.start,
    end: row.end,
    skipped: Boolean(row.skipped),
    shortestTime: row.shortestTime ?? '-',
    leastTransferTime: row.leastTransferTime ?? '-',
    leastTransfers: row.leastTransfers ?? '-',
    ok: row.skipped ? row.reason : row.ok,
  })));

  rows.forEach((row) => {
    if (row.skipped) {
      console.warn(`SKIP ${row.start} -> ${row.end}: ${row.reason}`);
      return;
    }
    console.log(`${row.start} -> ${row.end}`);
    console.log(`  shortest(${row.shortestTime}): ${row.shortestPath.join(' -> ')}`);
    console.log(`  leastTransfers(${row.leastTransferTime}, transfers=${row.leastTransfers}): ${row.leastTransferPath.join(' -> ')}`);
  });

  const failed = rows.filter((row) => !row.skipped && !row.ok);
  if (failed.length) {
    console.error('FAIL: shortest.time > leastTransfers.time detected');
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
