const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');

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

async function main() {
  const workday = loadJson('data/timetable.workday.json');
  const weekend = loadJson('data/timetable.weekend.json');
  const timetable = { ...workday, ...weekend };
  const stationData = loadJson('data/_station.json');
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
  document.getElementById('start-station').value = '西直门';
  document.getElementById('end-station').value = '北京南站';

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
  context.getRoute();

  const html = document.getElementById('result').innerHTML;
  const stationCount = Array.from(html.matchAll(/class="route-station/g)).length;

  assert(html.includes('乘车方案') || html.includes('方案'), 'result title missing');
  assert(html.includes('route-line-visual'), 'route-line-visual missing');
  assert(html.includes('route-line-block'), 'route-line-block missing');
  assert(html.includes('route-line-track'), 'route-line-track missing');
  assert(/--line-color:\s*#[0-9a-fA-F]{6}/.test(html), 'line color CSS variable missing');
  assert(stationCount > 2, `expected more than 2 route stations, got ${stationCount}`);
  assert(html.includes('西直门'), 'start station missing');
  assert(html.includes('北京南站'), 'end station missing');

  console.log('PASS: query result keeps colored route line UI');
}

main().catch((error) => {
  console.error('FAIL:', error.message);
  process.exitCode = 1;
});
