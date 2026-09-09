const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const stations = readJson('data/_station.json');
const timetable = { ...readJson('data/timetable.workday.json'), ...readJson('data/timetable.weekend.json') };
const pinyinMap = readJson('data/station_pinyin.json');

function createElement() {
    const listeners = {};
    const attributes = {};
    const classes = new Set();
    const element = {
        value: '', textContent: '', innerHTML: '', dataset: {}, hidden: false,
        classList: {
            add: (name) => classes.add(name),
            remove: (name) => classes.delete(name),
            contains: (name) => classes.has(name),
            toggle(name, force) {
                if (force ?? !classes.has(name)) classes.add(name);
                else classes.delete(name);
            },
        },
        setAttribute: (name, value) => { attributes[name] = value; },
        getAttribute: (name) => attributes[name],
        addEventListener(type, callback) { (listeners[type] ||= []).push(callback); },
        dispatchEvent(event) { (listeners[event.type] || []).forEach((callback) => callback(event)); },
        contains(target) { return target === this; },
        querySelectorAll() {
            return Array.from(this.innerHTML.matchAll(/data-kind="([^"]+)" data-value="([^"]+)"/g), (match) => {
                const option = createElement();
                option.dataset = { kind: match[1], value: match[2], station: match[1] === 'station' ? match[2] : '' };
                option.closest = () => option;
                option.scrollIntoView = () => {};
                option.click = () => element.dispatchEvent({ type: 'click', target: option });
                return option;
            });
        },
    };
    return element;
}

function createEnvironment() {
    const nodes = new Map();
    const timers = [];
    let now = new Date(2026, 8, 9, 10, 44).getTime();
    const document = createElement();
    document.visibilityState = 'visible';
    document.getElementById = (id) => {
        if (!nodes.has(id)) nodes.set(id, createElement());
        return nodes.get(id);
    };
    document.querySelectorAll = () => [];
    const context = vm.createContext({
        document, URLSearchParams,
        Date: class extends Date {
            constructor(...args) { super(...(args.length ? args : [now])); }
            static now() { return now; }
        },
        console: { log() {}, warn() {}, error(error) { throw error; } },
        CustomEvent: class { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
        setInterval(callback, delay) { timers.push({ callback, delay }); return timers.length; },
        setTimeout,
        location: { search: '', href: '' },
        localStorage: { getItem: () => '[]', setItem() {} },
        loadTimetableData: async () => timetable,
        TransitAPI: {
            loadStations: async () => stations,
            loadPinyin: async () => pinyinMap,
            getCapabilities: async () => ({ capabilities: { write: true } }),
            getNetworkSummary: async () => ({ stationCount: 404, lineCount: 27 }),
        },
    });
    context.window = context;
    const run = (file) => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
    const node = (id) => document.getElementById(id);
    const input = (id, value) => { node(id).value = value; node(id).dispatchEvent({ type: 'input' }); };
    const key = (id, name) => node(id).dispatchEvent({
        type: 'keydown', key: name, defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; },
    });
    return { context, document, timers, run, node, input, key, advance(minutes) { now += minutes * 60000; } };
}

async function main() {
    const home = createEnvironment();
    home.run('src/transitData.js');
    home.run('src/home.js');
    await new Promise(setImmediate);
    home.node('home-start').dispatchEvent({ type: 'focus' });
    assert.equal(home.node('home-start-menu').querySelectorAll().length, 404);
    home.input('home-start', 'xzm');
    home.key('home-start', 'ArrowDown');
    home.key('home-start', 'Enter');
    assert.equal(home.node('home-start').value, '西直门');
    assert.equal(home.context.location.href, '');
    assert.match(home.node('home-form-message').textContent, /继续选择目的站/);
    assert.equal(home.node('home-start-line').hidden, false);
    assert.match(home.node('home-start-line-summary').textContent, /2号线.*4号线大兴线.*13号线/);

    home.node('home-end-line').value = '4号线大兴线';
    home.node('home-end-line').dispatchEvent({ type: 'change' });
    home.input('home-end', '国贸');
    assert.match(home.node('home-end-menu').innerHTML, /没有匹配站点/);
    assert.match(home.node('home-form-message').textContent, /不属于所选线路/);
    home.node('home-submit').dispatchEvent({ type: 'click' });
    assert.equal(home.context.location.href, '');

    const departures = home.node('home-live-departures').innerHTML;
    const refreshTimer = home.timers.find((timer) => timer.delay === 1000);
    assert(refreshTimer, 'minute boundary checks must be scheduled');
    home.advance(1);
    refreshTimer.callback();
    assert.match(home.node('home-live-clock').textContent, /非实时.*10:45/);
    assert.notEqual(home.node('home-live-departures').innerHTML, departures);
    home.advance(1);
    home.document.dispatchEvent({ type: 'visibilitychange' });
    assert.match(home.node('home-live-clock').textContent, /非实时.*10:46/);
    assert(!home.node('home-live-departures').innerHTML.includes('即将进站'));

    const query = createEnvironment();
    query.run('src/transitData.js');
    query.run('src/query.js');
    await new Promise(setImmediate);
    const index = query.context.TransitData.buildLineIndex(stations, timetable, { pinyinMap });
    assert.equal(query.context.TransitData.resolveStationName(index, stations, '国贸', { lineFilter: '4号线大兴线' }), '');
    query.node('start-line-select').value = '4号线大兴线';
    query.input('start-station', '国贸');
    query.node('start-station').dataset.station = '国贸';
    assert.equal(query.context.__queryPickers.start.resolve(), '');
    assert.equal(query.context.resolvePickerStation('start-station'), '');

    query.context.__queryPickers.start.setStation('西直门');
    query.context.__queryPickers.end.setStation('国贸');
    assert.equal(query.node('start-line-select').hidden, false);
    query.context.getRoute();
    const result = query.node('result').innerHTML;
    assert.match(result, /route-line-visual/);
    assert.match(result, /含初始候车/);
    assert.equal(query.node('route-stale-message').hidden, true);
    query.context.setTravelRequirement('leastTransfers');
    assert.equal(query.node('route-stale-message').hidden, false);
    assert.equal(query.node('result').innerHTML, result);
    query.input('end-station', '不存在的站');
    query.context.getRoute();
    assert.equal(query.node('result').innerHTML, result);
    assert.match(query.node('route-stale-message').textContent, /重新查询/);
    query.context.__queryPickers.end.setStation('积水潭');
    query.context.getRoute();
    assert.equal(query.node('route-stale-message').hidden, true);
    assert.match(query.node('result').innerHTML, /route-line-visual/);
    query.node('start-line-select').dispatchEvent({ type: 'change' });
    assert.equal(query.node('route-stale-message').hidden, false);

    const route = { time: 30, lines: ['2号线', '1号线'], path: ['西直门', '国贸'] };
    const metrics = query.context.normalizeRouteMetrics(route, { startTime: 650, endTime: 684 }, 644);
    assert.equal(metrics.estimatedActualMinutes, 40);
    assert.equal(metrics.initialWaitMinutes, 6);
    assert.equal(metrics.staticTravelMinutes, 30);
    const unavailable = query.context.normalizeRouteMetrics(route, { hasEstimatedSegments: true }, 644);
    assert.equal(unavailable.estimatedActualMinutes, null);
    assert.equal(unavailable.initialWaitMinutes, null);
    assert.equal(unavailable.staticTravelMinutes, 30);
    const overnight = query.context.normalizeRouteMetrics(route, { startTime: 1445, endTime: 1460 }, 1435);
    assert.equal(overnight.estimatedActualMinutes, 25);
    assert.equal(overnight.initialWaitMinutes, 10);
    console.log('PASS: product interactions (404 stations, keyboard, line filters, stale colored routes, minute/visibility refresh, wait-inclusive metrics)');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
