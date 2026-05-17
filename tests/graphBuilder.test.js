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

const timetable = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'mini_timetable.json'), 'utf8'));
const stations = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'mini_station.json'), 'utf8'));
const graph = context.GraphBuilder.buildSubwayGraph(timetable, stations, { dayType: '工作日' });

assert(graph.stations.includes('A'));
assert(graph.stations.includes('B'));
assert(graph.stations.includes('C'));
assert(graph.stations.includes('D'));
assert(graph.adjacencyList.A.some((edge) => edge.station === 'B'));
assert(graph.adjacencyList.B.some((edge) => edge.station === 'D'));
assert(graph.edges.every((edge) => Number.isFinite(edge.travelTime)));
assert(graph.edges.every((edge) => Number.isFinite(edge.travelMinutes)));

console.log('PASS graphBuilder.test.js');
