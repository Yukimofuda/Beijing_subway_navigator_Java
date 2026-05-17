const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

function createElement(tag = 'div') {
  const listeners = {};
  const element = {
    tagName: tag.toUpperCase(),
    classList: {
      _set: new Set(),
      add(name) {
        this._set.add(name);
      },
      remove(name) {
        this._set.delete(name);
      },
      toggle(name, force) {
        if (force === undefined) {
          if (this._set.has(name)) this._set.delete(name);
          else this._set.add(name);
        } else if (force) this._set.add(name);
        else this._set.delete(name);
      },
      contains(name) {
        return this._set.has(name);
      },
    },
    style: {},
    textContent: '',
    innerHTML: '',
    value: '',
    dataset: {},
    disabled: false,
    children: [],
    appendChild(child) {
      this.children.push(child);
      this.innerHTML += child.textContent || '';
    },
    addEventListener(event, callback) {
      listeners[event] = listeners[event] || [];
      listeners[event].push(callback);
    },
    dispatchEvent(event) {
      for (const callback of listeners[event.type] || []) callback(event);
    },
    contains(target) {
      return target === this || this.children.includes(target);
    },
    setAttribute() {},
    _listeners: listeners,
  };
  Object.defineProperty(element, 'options', {
    get() {
      const matches = Array.from(this.innerHTML.matchAll(/<option value="([^"]*)">([^<]*)<\/option>/g));
      return matches.map((match) => ({ value: match[1], textContent: match[2] }));
    },
  });
  return element;
}

function createDom(ids) {
  const nodes = new Map();
  for (const id of ids) nodes.set(id, createElement('div'));
  return {
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, createElement('div'));
      return nodes.get(id);
    },
    createElement(tag) {
      return createElement(tag);
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    addEventListener(event, cb) {
      if (event === 'DOMContentLoaded') cb();
    },
    _nodes: nodes,
  };
}

function runScript(filename, context) {
  const code = fs.readFileSync(path.join(ROOT, filename), 'utf8');
  vm.runInContext(code, context, { filename });
}

async function testLinesPage(timetable) {
  const document = createDom(['lines']);
  const context = vm.createContext({
    document,
    window: { location: { href: '' } },
    loadTimetableData: async () => timetable,
    console: { log() {}, warn() {}, error() {} },
    setTimeout,
    clearTimeout,
    encodeURIComponent,
  });
  runScript('src/lines.js', context);
  await new Promise((r) => setTimeout(r, 20));
  const html = document.getElementById('lines').innerHTML;
  if (!html || !html.includes('line-button')) {
    throw new Error('lines.js did not render line buttons');
  }
}

async function testStationsPage(stationData) {
  const document = createDom(['line-buttons']);
  const context = vm.createContext({
    document,
    window: { location: { href: '' }, localStorage: { setItem() {} }, showToast() {} },
    localStorage: { setItem() {} },
    fetch: async () => ({ ok: true, json: async () => stationData }),
    console: { log() {}, warn() {}, error() {} },
    setTimeout,
    clearTimeout,
  });
  runScript('src/stations.js', context);
  await new Promise((r) => setTimeout(r, 20));
  const node = document.getElementById('line-buttons');
  if (!node.children.length) {
    throw new Error('stations.js did not append any line buttons');
  }
}

async function testTrainsPage(timetable) {
  const document = createDom(['trains', 'current-line']);
  const context = vm.createContext({
    document,
    window: { location: { search: '?line=19%E5%8F%B7%E7%BA%BF', href: '' } },
    loadTimetableData: async () => timetable,
    console: { log() {}, warn() {}, error() {} },
    setTimeout,
    clearTimeout,
    URLSearchParams,
    encodeURIComponent,
  });
  runScript('src/trains.js', context);
  await new Promise((r) => setTimeout(r, 20));
  const html = document.getElementById('trains').innerHTML;
  if (!html || !html.includes('190000')) {
    throw new Error('trains.js did not render 19号线 trains');
  }
}

async function testQueryPage(timetable, stationData) {
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
  document.getElementById('end-station').value = '积水潭';

  const sandboxWindow = {
    showToast() {},
    location: { search: '' },
  };
  sandboxWindow.window = sandboxWindow;
  const context = vm.createContext({
    document,
    window: sandboxWindow,
    loadTimetableData: async () => timetable,
    fetch: async (url) => {
      if (url === 'data/_station.json') return { ok: true, json: async () => stationData };
      if (url === 'data/station_pinyin.json') {
        return {
          ok: true,
          json: async () => ({ 西直门: { pinyin: 'xizhimen', initials: 'xzm' } }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    },
    console: { log() {}, warn() {}, error() {} },
    setInterval: () => 0,
    clearInterval: () => {},
    setTimeout,
    clearTimeout,
    parseInt,
    isNaN,
    Math,
    Date,
    URLSearchParams,
    CustomEvent: function CustomEvent(type, init = {}) {
      return { type, detail: init.detail };
    },
    alert() {},
  });
  context.window = context;
  context.globalThis = context;
  context.location = { search: '' };
  context.showToast = () => {};
  runScript('src/transitData.js', context);
  runScript('src/query.js', context);
  await new Promise((r) => setTimeout(r, 120));
  const status = document.getElementById('data-status').textContent;
  if (status !== '数据已就绪') {
    throw new Error(`query.js data not ready, status=${status}`);
  }
  const button = document.getElementById('query-button');
  if (button.disabled) {
    throw new Error('query button still disabled after data load');
  }
  document.getElementById('start-station').dispatchEvent({ type: 'focus' });
  const startMenu = document.getElementById('start-station-menu').innerHTML;
  if (!startMenu.includes('西直门')) {
    throw new Error('query station picker did not prepare integrated station options');
  }
  document.getElementById('start-station').value = 'xzm';
  document.getElementById('start-station').dispatchEvent({ type: 'input' });
  if (!document.getElementById('start-station-menu').innerHTML.includes('西直门')) {
    throw new Error('query station picker did not match pinyin initials');
  }
  context.getRoute();
  const resultHtml = document.getElementById('result').innerHTML;
  if (!resultHtml.includes('乘车方案')) {
    throw new Error('query route did not render a result');
  }
  if (!resultHtml.includes('route-line-visual') || !resultHtml.includes('--line-color')) {
    throw new Error('query route result lost colored route line UI');
  }
}

function checkJsonFileSizes() {
  const dataDir = path.join(ROOT, 'data');
  const files = fs.readdirSync(dataDir).filter((name) => name.endsWith('.json'));
  const limit = 25 * 1024 * 1024;
  const report = [];
  for (const file of files) {
    const filePath = path.join(dataDir, file);
    const size = fs.statSync(filePath).size;
    report.push({ file, size });
    if (size >= limit) {
      throw new Error(`JSON too large: ${file} (${size} bytes)`);
    }
  }
  return report;
}

function checkMapViewerHtml() {
  const mapPath = path.join(ROOT, 'Map.html');
  const html = fs.readFileSync(mapPath, 'utf8');
  if (!html.includes('id="subwayMap"')) {
    throw new Error('Map viewer missing subwayMap element');
  }
  if (!html.includes('src/mapExplorer.js')) {
    throw new Error('Map viewer is not using interactive map explorer script');
  }
  if (!html.includes('id="mapViewport"')) {
    throw new Error('Map viewer missing viewport container');
  }
  const mapScript = fs.readFileSync(path.join(ROOT, 'src', 'mapExplorer.js'), 'utf8');
  if (!mapScript.includes('nextArrivals') || !mapScript.includes('station-hit')) {
    throw new Error('Map explorer missing station hover arrival logic');
  }
}

async function main() {
  const timetable = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'data', 'timetable.workday.json'), 'utf8')
  );
  const weekend = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'data', 'timetable.weekend.json'), 'utf8')
  );
  const merged = { ...timetable, ...weekend };
  const stationData = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'data', '_station.json'), 'utf8')
  );

  await testLinesPage(merged);
  await testStationsPage(stationData);
  await testTrainsPage(merged);
  await testQueryPage(merged, stationData);
  checkMapViewerHtml();
  const sizeReport = checkJsonFileSizes();

  console.log('PASS: page data load smoke tests');
  for (const item of sizeReport) {
    const mb = (item.size / 1024 / 1024).toFixed(2);
    console.log(`JSON ${item.file}: ${mb}MB`);
  }
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exitCode = 1;
});
