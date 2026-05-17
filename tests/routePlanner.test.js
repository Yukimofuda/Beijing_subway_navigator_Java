const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');

function runScript(context, filename) {
  const code = fs.readFileSync(path.join(ROOT, filename), 'utf8');
  vm.runInContext(code, context, { filename });
}

const context = vm.createContext({ console });
context.globalThis = context;
context.window = context;

runScript(context, 'src/transitData.js');
runScript(context, 'src/transferPolicy.js');
runScript(context, 'src/graphBuilder.js');
runScript(context, 'src/routePlanner.js');
runScript(context, 'src/routeSummary.js');

const timetable = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'mini_timetable.json'), 'utf8'));
const stations = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'mini_station.json'), 'utf8'));
const graph = context.GraphBuilder.buildSubwayGraph(timetable, stations, { dayType: '工作日' });

const fastest = context.RoutePlanner.findFastestRoute(graph, 'A', 'D', { dwellMinutes: 1 });
assert(fastest);
assert.deepStrictEqual(Array.from(fastest.path), ['A', 'B', 'D']);
assert(fastest.transfers >= 1);
assert(Number.isFinite(fastest.totalMinutes));

const leastTransfers = context.RoutePlanner.findMinTransferRoute(graph, 'A', 'D', { dwellMinutes: 1 });
assert(leastTransfers);
assert(Array.isArray(leastTransfers.edges));
assert(leastTransfers.edges.length >= 2);

console.log('PASS routePlanner.test.js');
