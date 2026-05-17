const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');

function runScript(context, filename) {
    const code = fs.readFileSync(path.join(ROOT, filename), 'utf8');
    vm.runInContext(code, context, { filename });
}

function createClassList() {
    const values = new Set();
    return {
        add(value) {
            values.add(value);
        },
        remove(value) {
            values.delete(value);
        },
        contains(value) {
            return values.has(value);
        }
    };
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
        contains() {
            return false;
        },
        get listeners() {
            return listeners;
        }
    };
}

function createOption(kind, value) {
    return {
        dataset: kind === 'station'
            ? { kind, value, station: value }
            : { kind, value },
        closest() {
            return this;
        }
    };
}

function CustomEvent(type, init = {}) {
    return { type, detail: init.detail };
}

const documentMock = {
    addEventListener() {}
};

const context = vm.createContext({
    console,
    window: {},
    document: documentMock,
    CustomEvent
});
context.window = context;
context.globalThis = context;
context.document = documentMock;
context.CustomEvent = CustomEvent;

runScript(context, 'src/transitData.js');

const stations = {
    A: { lines: ['12号线'] },
    B: { lines: ['12号线'] },
    蓟门桥: { lines: ['12号线', '昌平线'] },
    西直门: { lines: ['2号线', '4号线'] },
    国贸: { lines: ['1号线', '10号线'] }
};

const timetable = {
    工作日: {
        '1号线': {
            上行: {
                train1: [['国贸', '08:00']]
            }
        },
        '2号线': {
            内环: {
                train1: [['西直门', '08:00']]
            }
        },
        '12号线': {
            'A-B': {
                train1: [['A', '08:00'], ['蓟门桥', '08:02'], ['B', '08:04']]
            }
        },
        昌平线: {
            上行: {
                train1: [['蓟门桥', '08:00']]
            }
        }
    }
};

const pinyinMap = {
    西直门: { pinyin: 'xizhimen', initials: 'xzm' },
    国贸: { pinyin: 'guomao', initials: 'gm' },
    蓟门桥: { pinyin: 'jimenqiao', initials: 'jmq' }
};

const TransitData = context.TransitData;
const index = TransitData.buildLineIndex(stations, timetable, { pinyinMap });

assert(Array.isArray(index.lines), 'buildLineIndex should return lines');
assert(Array.isArray(index.stations), 'buildLineIndex should return stations');
assert(index.lineMap && typeof index.lineMap.get === 'function', 'buildLineIndex should return lineMap');

const lineMatches = TransitData.matchLineCandidates(index, '12');
assert(lineMatches.some((line) => line.label === '12号线'), '12 should match 12号线');

const stationMatches = TransitData.matchStationCandidates(index, stations, '蓟门');
assert(stationMatches.includes('蓟门桥'), '蓟门 should match 蓟门桥');

const pinyinMatches = TransitData.matchStationCandidates(index, stations, 'xzm');
assert(pinyinMatches.includes('西直门'), 'xzm should match 西直门');

assert.strictEqual(
    TransitData.resolveStationName(index, stations, '蓟门'),
    '蓟门桥',
    'unique fuzzy station input should resolve to real station name'
);

const input = createElement();
const menu = createElement();
const lineSelect = createElement();
const lineSummary = createElement();
let changedStation = '';

input.addEventListener('stationchange', (event) => {
    changedStation = event.detail.station;
});

const picker = TransitData.createStationPicker(index, stations, {
    input,
    menu,
    lineSelect,
    lineSummary
});

input.value = '蓟门';
input.dispatchEvent({ type: 'input' });
assert(menu.innerHTML.includes('蓟门桥'), 'picker menu should render matched station');

menu.listeners.click[0]({
    target: createOption('station', '蓟门桥')
});

assert.strictEqual(picker.resolve(), '蓟门桥', 'picker should resolve selected station');
assert.strictEqual(changedStation, '蓟门桥', 'picker should dispatch stationchange');

console.log('PASS: station picker matching audit');
