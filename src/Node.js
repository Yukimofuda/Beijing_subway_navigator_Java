const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const fsSync = require('fs');

const app = express();
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const HOST = process.env.HOST || '127.0.0.1';
const START_PORT = Number(process.env.PORT) || 3000;
const jsonCache = new Map();

app.disable('x-powered-by');
app.use(express.json({ limit: '40mb' }));

function dataPath(...parts) {
    return path.join(DATA_DIR, ...parts);
}

function isRecord(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function readJson(filename) {
    const filenamePath = dataPath(filename);
    const stat = await fs.stat(filenamePath);
    const cached = jsonCache.get(filenamePath);
    if (cached && cached.mtimeMs === stat.mtimeMs) return cached.value;
    const value = JSON.parse(await fs.readFile(filenamePath, 'utf8'));
    jsonCache.set(filenamePath, { mtimeMs: stat.mtimeMs, value });
    return value;
}

async function writeJsonAtomic(filename, value) {
    const target = dataPath(filename);
    const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await fs.rename(temporary, target);
    jsonCache.delete(target);
}

async function loadTimetableParts() {
    const [workday, weekend] = await Promise.all([
        readJson('timetable.workday.json'),
        readJson('timetable.weekend.json'),
    ]);
    return { workday, weekend };
}

function simplifyLineName(lineName) {
    return String(lineName || '')
        .replace(/^地铁/, '')
        .replace(/\(.+\)$/, '')
        .replace(/(内环|外环)$/, '')
        .trim();
}

function collectTimetableStations(dayData) {
    const stations = new Set();
    for (const lineData of Object.values(dayData || {})) {
        for (const trains of Object.values(lineData || {})) {
            for (const schedule of Object.values(trains || {})) {
                if (!Array.isArray(schedule)) continue;
                schedule.forEach((stop) => {
                    if (stop?.[0]) stations.add(stop[0]);
                });
            }
        }
    }
    return stations;
}

function buildLineSummaries(stations, timetable) {
    const dayData = timetable?.['工作日'] || timetable || {};
    const buckets = new Map();

    function ensureLine(rawLineName) {
        const label = simplifyLineName(rawLineName);
        if (!buckets.has(label)) {
            buckets.set(label, { label, fullNames: new Set(), stations: new Set(), directions: 0 });
        }
        const bucket = buckets.get(label);
        bucket.fullNames.add(rawLineName);
        return bucket;
    }

    for (const [stationName, info] of Object.entries(stations || {})) {
        for (const rawLineName of info.lines || []) ensureLine(rawLineName).stations.add(stationName);
    }

    for (const [rawLineName, lineData] of Object.entries(dayData)) {
        const bucket = ensureLine(rawLineName);
        bucket.directions = Object.keys(lineData || {}).length;
        for (const trains of Object.values(lineData || {})) {
            for (const schedule of Object.values(trains || {})) {
                if (!Array.isArray(schedule)) continue;
                schedule.forEach((stop) => {
                    if (stop?.[0] && stations?.[stop[0]]) bucket.stations.add(stop[0]);
                });
            }
        }
    }

    return Array.from(buckets.values())
        .map((bucket) => ({
            label: bucket.label,
            fullNames: Array.from(bucket.fullNames),
            stationCount: bucket.stations.size,
            directionCount: bucket.directions,
        }))
        .sort((first, second) => first.label.localeCompare(second.label, 'zh-CN', { numeric: true }));
}

function removeStationsFromTimetable(dayData, lineName, stationNames) {
    const target = simplifyLineName(lineName);
    const stationSet = new Set(stationNames);

    for (const line of Object.keys(dayData || {})) {
        if (line !== lineName && simplifyLineName(line) !== target) continue;
        const lineData = dayData[line];
        for (const direction of Object.keys(lineData || {})) {
            const trains = lineData[direction];
            for (const train of Object.keys(trains || {})) {
                trains[train] = trains[train].filter(([station]) => !stationSet.has(station));
                if (trains[train].length < 2) delete trains[train];
            }
            if (!Object.keys(trains || {}).length) delete lineData[direction];
        }
        if (!Object.keys(lineData || {}).length) delete dayData[line];
    }
}

function sendServerError(res, error, publicMessage) {
    console.error(publicMessage, error);
    res.status(500).json({ ok: false, error: publicMessage });
}

let activePort = null;

app.get(['/health', '/api/health'], (req, res) => {
    res.json({
        ok: true,
        port: activePort,
        mode: 'local-write',
        capabilities: { read: true, write: true },
    });
});

app.get('/server-info.json', (req, res) => res.json({ port: activePort, host: HOST }));

app.get('/api/network', async (req, res) => {
    try {
        const [stations, { workday, weekend }] = await Promise.all([
            readJson('_station.json'),
            loadTimetableParts(),
        ]);
        const workdayData = workday['工作日'] || workday;
        const weekendData = weekend['双休日'] || weekend['周末'] || weekend;
        const [stationStat, workdayStat, weekendStat] = await Promise.all([
            fs.stat(dataPath('_station.json')),
            fs.stat(dataPath('timetable.workday.json')),
            fs.stat(dataPath('timetable.weekend.json')),
        ]);
        res.json({
            stationCount: Object.keys(stations).length,
            lineCount: buildLineSummaries(stations, workday).length,
            workdayStationCount: collectTimetableStations(workdayData).size,
            weekendStationCount: collectTimetableStations(weekendData).size,
            dayTypes: ['工作日', '双休日'],
            updatedAt: new Date(Math.max(stationStat.mtimeMs, workdayStat.mtimeMs, weekendStat.mtimeMs)).toISOString(),
            source: 'local-json',
        });
    } catch (error) {
        sendServerError(res, error, '读取网络概览失败');
    }
});

app.get('/api/stations', async (req, res) => {
    try {
        res.json(await readJson('_station.json'));
    } catch (error) {
        sendServerError(res, error, '读取站点数据失败');
    }
});

app.get('/api/stations/:stationName', async (req, res) => {
    try {
        const stations = await readJson('_station.json');
        const stationName = req.params.stationName;
        if (!stations[stationName]) {
            res.status(404).json({ ok: false, error: '未找到站点' });
            return;
        }
        res.json({ name: stationName, ...stations[stationName] });
    } catch (error) {
        sendServerError(res, error, '读取站点详情失败');
    }
});

app.get('/api/lines', async (req, res) => {
    try {
        const [stations, timetable] = await Promise.all([
            readJson('_station.json'),
            readJson('timetable.workday.json'),
        ]);
        res.json({ lines: buildLineSummaries(stations, timetable) });
    } catch (error) {
        sendServerError(res, error, '读取线路数据失败');
    }
});

app.get('/api/timetable', async (req, res) => {
    try {
        const requestedDay = String(req.query.day || 'workday').toLowerCase();
        const filename = ['weekend', '双休日', '周末'].includes(requestedDay)
            ? 'timetable.weekend.json'
            : 'timetable.workday.json';
        res.json(await readJson(filename));
    } catch (error) {
        sendServerError(res, error, '读取时刻表失败');
    }
});

app.get('/api/station-details', async (req, res) => {
    try {
        res.json(await readJson('station_details.json'));
    } catch (error) {
        sendServerError(res, error, '读取站点导览数据失败');
    }
});

app.get('/api/pinyin', async (req, res) => {
    try {
        res.json(await readJson('station_pinyin.json'));
    } catch (error) {
        sendServerError(res, error, '读取拼音索引失败');
    }
});

app.post('/saveStationData', async (req, res) => {
    try {
        if (!isRecord(req.body)) {
            res.status(400).json({ ok: false, error: '站点数据必须是 JSON 对象' });
            return;
        }
        await writeJsonAtomic('_station.json', req.body);
        res.json({ ok: true, message: '站点数据保存成功' });
    } catch (error) {
        sendServerError(res, error, '保存站点数据失败');
    }
});

app.post('/saveTimetableData', async (req, res) => {
    try {
        if (!isRecord(req.body)) {
            res.status(400).json({ ok: false, error: '时刻表数据必须是 JSON 对象' });
            return;
        }
        const { workday, weekend } = await loadTimetableParts();
        const newData = req.body;
        const incomingWorkday = newData['工作日'] || newData;
        const incomingWeekend = newData['双休日'] || newData['周末'] || newData;
        const mergedWorkday = { ...(workday['工作日'] || workday), ...incomingWorkday };
        const mergedWeekend = { ...(weekend['双休日'] || weekend['周末'] || weekend), ...incomingWeekend };
        await Promise.all([
            writeJsonAtomic('timetable.workday.json', { 工作日: mergedWorkday }),
            writeJsonAtomic('timetable.weekend.json', { 双休日: mergedWeekend }),
        ]);
        res.json({ ok: true, message: '时刻表数据保存成功' });
    } catch (error) {
        sendServerError(res, error, '保存时刻表数据失败');
    }
});

app.post('/deleteTimetableStations', async (req, res) => {
    try {
        const { lineName, stations } = req.body || {};
        if (!lineName || !Array.isArray(stations) || !stations.length) {
            res.status(400).json({ ok: false, error: 'lineName 和 stations 必填' });
            return;
        }
        const { workday, weekend } = await loadTimetableParts();
        removeStationsFromTimetable(workday['工作日'] || workday, lineName, stations);
        removeStationsFromTimetable(weekend['双休日'] || weekend['周末'] || weekend, lineName, stations);
        await Promise.all([
            writeJsonAtomic('timetable.workday.json', workday),
            writeJsonAtomic('timetable.weekend.json', weekend),
        ]);
        res.json({ ok: true, message: '时刻表站点删除成功' });
    } catch (error) {
        sendServerError(res, error, '删除时刻表站点失败');
    }
});

app.use(express.static(ROOT_DIR, { extensions: ['html'] }));

function createServer(port) {
    const server = app.listen(port, HOST, async () => {
        activePort = port;
        const payload = JSON.stringify({ port, host: HOST }, null, 2);
        try {
            await fs.writeFile(path.join(ROOT_DIR, '.server-info.json'), payload);
        } catch (error) {
            console.warn('写入 .server-info.json 失败:', error.message);
        }
        console.log(`服务器运行在 http://localhost:${port}`);
        if (HOST === '0.0.0.0') console.log(`局域网访问已启用，端口 ${port}`);
    });

    server.on('error', (error) => {
        if (error.code === 'EADDRINUSE' && !process.env.PORT) {
            console.warn(`端口 ${port} 被占用，尝试下一个端口...`);
            createServer(port + 1);
            return;
        }
        console.error('服务器启动失败:', error);
    });
}

if (!fsSync.existsSync(DATA_DIR)) {
    console.error('缺少 data 目录，无法启动服务。');
    process.exit(1);
}

createServer(START_PORT);
