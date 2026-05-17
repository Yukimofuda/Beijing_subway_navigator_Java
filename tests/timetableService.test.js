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
runScript(context, 'src/timetableService.js');

const timetable = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'mini_timetable.json'), 'utf8'));
const index = context.TimetableService.buildArrivalIndex(timetable, { dayType: '工作日' });
const eightOhThree = context.TimetableService.timeStringToMinutes('08:03');

assert((index.byStation.get('B') || []).length > 0);

const next = context.TimetableService.getNextArrivals(index, 'B', eightOhThree, { line: '2号线' });
assert.strictEqual(next[0].time, '08:08');

const last = context.TimetableService.getLastTrain(index, 'B', { line: '2号线' });
assert.strictEqual(last.time, '08:18');

console.log('PASS timetableService.test.js');
