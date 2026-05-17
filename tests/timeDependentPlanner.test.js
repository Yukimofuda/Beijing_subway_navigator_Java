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
runScript(context, 'src/timetableService.js');
runScript(context, 'src/routeFeasibility.js');
runScript(context, 'src/timeDependentPlanner.js');

const timetable = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'mini_timetable.json'), 'utf8'));
const stations = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'mini_station.json'), 'utf8'));
const graph = context.GraphBuilder.buildSubwayGraph(timetable, stations, { dayType: '工作日' });
const index = context.TimetableService.buildArrivalIndex(timetable, { dayType: '工作日' });

const eightOhOne = context.TimetableService.timeStringToMinutes('08:01');
const route = context.TimeDependentPlanner.findEarliestArrivalRoute(
  graph,
  index,
  'A',
  'D',
  eightOhOne,
  {
    dwellMinutes: 1,
    transferPenaltyMinutes: 5,
  }
);

assert(route);
assert.deepStrictEqual(Array.from(route.path), ['A', 'B', 'D']);
assert.strictEqual(context.TimetableService.minutesToTimeString(route.edges[0].departMinute), '08:10');
assert.strictEqual(context.TimetableService.minutesToTimeString(route.arriveMinute), '08:22');

const warnings = context.RouteFeasibility.checkLastTrainRisk(route, index, { safetyMarginMinutes: 5 });
assert(warnings.some((warning) => warning.type === context.RouteFeasibility.FeasibilityStatus.LOW_MARGIN));

const eightThirty = context.TimetableService.timeStringToMinutes('08:30');
const missed = context.TimeDependentPlanner.findEarliestArrivalRoute(
  graph,
  index,
  'A',
  'D',
  eightThirty,
  {
    dwellMinutes: 1,
    transferPenaltyMinutes: 5,
  }
);
assert.strictEqual(missed, null);

console.log('PASS timeDependentPlanner.test.js');
