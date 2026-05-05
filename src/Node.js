const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const fsSync = require('fs');
const app = express();

app.use(express.json());

const ROOT_DIR = path.resolve(__dirname, '..');
const dataPath = (...parts) => path.join(ROOT_DIR, 'data', ...parts);

// Serve the static site (fixes file:// fetch/object blocked issues)
app.use(express.static(ROOT_DIR));

async function loadTimetableParts() {
    const [workdayRaw, weekendRaw] = await Promise.all([
        fs.readFile(dataPath('timetable.workday.json'), 'utf8'),
        fs.readFile(dataPath('timetable.weekend.json'), 'utf8'),
    ]);
    return {
        workday: JSON.parse(workdayRaw),
        weekend: JSON.parse(weekendRaw),
    };
}

function simplifyLineName(lineName) {
    return String(lineName || '')
        .replace(/^地铁/, '')
        .replace(/\(.+\)$/, '')
        .trim();
}

function removeStationsFromTimetable(dayData, lineName, stationNames) {
    const target = simplifyLineName(lineName);
    const stationSet = new Set(stationNames);

    for (const line of Object.keys(dayData || {})) {
        if (line !== lineName && simplifyLineName(line) !== target) continue;
        const lineData = dayData[line];

        for (const direction of Object.keys(lineData)) {
            const trains = lineData[direction];
            for (const train of Object.keys(trains)) {
                trains[train] = trains[train].filter(([station]) => !stationSet.has(station));
                if (trains[train].length < 2) delete trains[train];
            }
            if (!Object.keys(trains).length) delete lineData[direction];
        }

        if (!Object.keys(lineData).length) delete dayData[line];
    }
}

// Existing endpoint for station data
app.post('/saveStationData', async (req, res) => {
    try {
        const data = req.body;
        await fs.writeFile(dataPath('_station.json'), JSON.stringify(data, null, 2));
        res.json({ message: '站点数据保存成功' });
    } catch (err) {
        console.error('保存站点数据失败:', err);
        res.status(500).json({ error: '保存站点数据失败' });
    }
});

// New endpoint for timetable data
app.post('/saveTimetableData', async (req, res) => {
    try {
        const newData = req.body;
        // Load existing split timetable parts (fallback to timetable.json)
        let existingData = {};
        try {
            const [workdayRaw, weekendRaw] = await Promise.all([
                fs.readFile(dataPath('timetable.workday.json'), 'utf8'),
                fs.readFile(dataPath('timetable.weekend.json'), 'utf8'),
            ]);
            existingData = {
                ...JSON.parse(workdayRaw),
                ...JSON.parse(weekendRaw),
            };
        } catch (err) {
            try {
                const fileContent = await fs.readFile(dataPath('timetable.json'), 'utf8');
                existingData = JSON.parse(fileContent);
            } catch (innerErr) {
                console.log('No existing timetable data, creating new one');
            }
        }

        const incomingWorkday = newData['工作日'] ? newData['工作日'] : newData;
        const incomingWeekend = newData['双休日']
            ? newData['双休日']
            : newData['周末']
              ? newData['周末']
              : newData;

        const mergedWorkday = { ...(existingData['工作日'] || {}), ...incomingWorkday };
        const mergedWeekend = { ...(existingData['双休日'] || existingData['周末'] || {}), ...incomingWeekend };

        await Promise.all([
            fs.writeFile(dataPath('timetable.workday.json'), JSON.stringify({ 工作日: mergedWorkday }, null, 2)),
            fs.writeFile(dataPath('timetable.weekend.json'), JSON.stringify({ 双休日: mergedWeekend }, null, 2)),
        ]);
        res.json({ message: '时刻表数据保存成功' });
    } catch (err) {
        console.error('保存时刻表数据失败:', err);
        res.status(500).json({ error: '保存时刻表数据失败' });
    }
});

app.post('/deleteTimetableStations', async (req, res) => {
    try {
        const { lineName, stations } = req.body || {};
        if (!lineName || !Array.isArray(stations) || !stations.length) {
            res.status(400).json({ error: 'lineName 和 stations 必填' });
            return;
        }

        const { workday, weekend } = await loadTimetableParts();
        removeStationsFromTimetable(workday['工作日'], lineName, stations);
        removeStationsFromTimetable(weekend['双休日'] || weekend['周末'], lineName, stations);

        await Promise.all([
            fs.writeFile(dataPath('timetable.workday.json'), JSON.stringify(workday, null, 2)),
            fs.writeFile(dataPath('timetable.weekend.json'), JSON.stringify(weekend, null, 2)),
        ]);

        res.json({ message: '时刻表站点删除成功' });
    } catch (err) {
        console.error('删除时刻表站点失败:', err);
        res.status(500).json({ error: '删除时刻表站点失败' });
    }
});

let activePort = null;

app.get('/health', (req, res) => res.json({ ok: true, port: activePort }));
app.get('/server-info.json', (req, res) => res.json({ port: activePort }));

function createServer(port) {
    const server = app.listen(port, '127.0.0.1', async () => {
        activePort = port;
        const infoPath = path.join(ROOT_DIR, '.server-info.json');
        const payload = JSON.stringify({ port, host: '127.0.0.1' }, null, 2);
        try {
            await fs.writeFile(infoPath, payload);
        } catch (err) {
            console.warn('写入 .server-info.json 失败:', err.message);
        }
        console.log(`服务器运行在 http://localhost:${port}`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.warn(`端口 ${port} 被占用，尝试下一个端口...`);
            createServer(port + 1);
            return;
        }
        if (err.code === 'EPERM') {
            console.error(`端口 ${port} 无权限监听，请在本机终端运行并检查系统权限。`);
            return;
        }
        console.error('服务器启动失败:', err);
    });
}

if (!fsSync.existsSync(path.join(ROOT_DIR, 'data'))) {
    console.error('缺少 data 目录，无法启动服务。');
    process.exit(1);
}

createServer(3000);
