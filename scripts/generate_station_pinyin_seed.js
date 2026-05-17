const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const stationPath = path.join(ROOT, 'data', '_station.json');
const outputPath = path.join(ROOT, 'data', 'station_pinyin.json');

function readJson(filePath, fallback = {}) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return fallback;
    }
}

const stations = readJson(stationPath);
const existing = readJson(outputPath);
const template = {};

for (const stationName of Object.keys(stations).sort((a, b) => a.localeCompare(b, 'zh-CN'))) {
    template[stationName] = existing[stationName] || {
        pinyin: '',
        initials: ''
    };
}

fs.writeFileSync(outputPath, `${JSON.stringify(template, null, 2)}\n`);
console.log(`station pinyin seed written: ${path.relative(ROOT, outputPath)}`);
