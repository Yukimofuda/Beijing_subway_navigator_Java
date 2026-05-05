const fs = require('fs').promises;
const path = require('path');

async function main() {
  const candidateInputs = [
    process.argv[2],
    path.join('data', 'timetable.json'),
    path.join('data', 'timetable.full.json'),
  ].filter(Boolean);

  let inputPath = null;
  for (const candidate of candidateInputs) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await fs.access(candidate);
      inputPath = candidate;
      break;
    } catch {
      // ignore
    }
  }

  if (!inputPath) {
    throw new Error(
      `Input timetable file not found. Pass a path: node scripts/split_timetable.js data/timetable.full.json`
    );
  }
  const raw = await fs.readFile(inputPath, 'utf8');
  const timetable = JSON.parse(raw);

  const workdayKey = timetable['工作日'] ? '工作日' : null;
  const weekendKey = timetable['双休日']
    ? '双休日'
    : timetable['周末']
      ? '周末'
      : null;

  if (!workdayKey || !weekendKey) {
    throw new Error(
      `Unsupported timetable root keys. Expected 工作日 + (双休日|周末), got: ${Object.keys(timetable).join(', ')}`
    );
  }

  const outputs = [
    {
      outPath: path.join('data', 'timetable.workday.json'),
      data: { [workdayKey]: timetable[workdayKey] },
    },
    {
      outPath: path.join('data', 'timetable.weekend.json'),
      data: { [weekendKey]: timetable[weekendKey] },
    },
  ];

  for (const { outPath, data } of outputs) {
    const pretty = JSON.stringify(data, null, 2);
    await fs.writeFile(outPath, pretty);
    const mb = (Buffer.byteLength(pretty, 'utf8') / 1024 / 1024).toFixed(2);
    console.log(`${outPath}: ${mb} MB`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
