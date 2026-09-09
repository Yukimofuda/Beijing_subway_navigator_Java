let travelRequirement = '最短时间'; // 用户选择的路径偏好，默认为最短时间
let timetableData = null; // 用于存储从timetable.json文件加载的地铁时刻表数据
let stationData = null; // 用于存储从_station.json文件加载的站点信息数据
let currentTimeInMinutes = 0; // 当前时间，以分钟为单位
let subwayGraph = null; // 基于时刻表数据构地铁线路图，使用邻接表的数据结构
let transferWeights = {}; // 换乘站点的权重，用于标记换乘站
let isDataReady = false; // 标记时刻表和站点数据是否加载完成
let stationPickerIndex = null;
let stationPinyinMap = {};
let hasAutoQueried = false;
let hasRouteResult = false;
const RECENT_ROUTE_KEY = 'subwayRecentRoutes';

function setDataReadyState(ready) {
    isDataReady = ready;
    const queryButton = document.getElementById('query-button');
    if (queryButton) queryButton.disabled = !ready;
    const statusEl = document.getElementById('data-status');
    if (statusEl) statusEl.textContent = ready ? '数据已就绪' : '正在准备';
}

function simplifyLineName(lineName) {
    return String(lineName || '')
        .replace(/^地铁/, '')
        .replace(/\(.+\)$/, '')
        .replace(/(内环|外环)$/, '')
        .trim();
}

function canonicalLineName(lineName) {
    return simplifyLineName(lineName);
}

function buildStationPickerIndex(stations) {
    if (!window.TransitData || !window.TransitData.buildLineIndex) {
        console.error('TransitData.buildLineIndex is required');
        const stationNames = Object.keys(stations || {});
        return {
            stations: stationNames,
            stationSet: new Set(stationNames),
            stationMap: stations || {},
            lines: [],
            lineMap: new Map()
        };
    }
    return window.TransitData.buildLineIndex(stations, timetableData, {
        pinyinMap: stationPinyinMap || {}
    });
}

function setupStationPickers() {
    if (!stationPickerIndex) return;
    if (!window.TransitData || !window.TransitData.createStationPicker) {
        console.error('TransitData.createStationPicker is required for query station picker');
        return;
    }

    const configs = [
        {
            input: document.getElementById('start-station'),
            menu: document.getElementById('start-station-menu'),
            lineSelect: document.getElementById('start-line-select'),
            lineSummary: document.getElementById('start-line-summary'),
        },
        {
            input: document.getElementById('end-station'),
            menu: document.getElementById('end-station-menu'),
            lineSelect: document.getElementById('end-line-select'),
            lineSummary: document.getElementById('end-line-summary'),
        },
    ];

    const pickers = configs.map((config) =>
        window.TransitData.createStationPicker(stationPickerIndex, stationData, {
            ...config,
            keepLineSelect: true,
            openShowsAll: true,
            clearStationOnLineChange: true,
            autoSelectFirstStation: false,
            resolveFuzzy: false
        })
    );
    window.__queryPickers = { start: pickers[0], end: pickers[1] };
    configs.forEach(({ input, lineSelect }) => {
        ['input', 'stationchange', 'linechange'].forEach((event) => input.addEventListener(event, markRouteStale));
        lineSelect.addEventListener('change', markRouteStale);
    });
    applyRouteParams();
}

function markRouteStale() {
    const notice = document.getElementById('route-stale-message');
    if (!hasRouteResult || !notice) return;
    notice.textContent = '条件已更改，请重新查询。下方保留的是上次方案。';
    notice.hidden = false;
}

function applyRouteParams() {
    const params = new URLSearchParams(window.location.search);
    const start = params.get('start') || params.get('station');
    const end = params.get('end');
    const mode = params.get('mode');
    if (mode === 'shortestTime' || mode === 'leastTransfers') setTravelRequirement(mode);
    if (start && stationData[start]) window.__queryPickers?.start?.setStation(start);
    if (end && stationData[end]) window.__queryPickers?.end?.setStation(end);
    if (!hasAutoQueried && params.get('auto') === '1' && start && end && stationData[start] && stationData[end]) {
        hasAutoQueried = true;
        setTimeout(() => {
            if (isDataReady) getRoute();
        }, 0);
    }
}

function swapRouteEndpoints() {
    const start = resolvePickerStation('start-station');
    const end = resolvePickerStation('end-station');
    if (end) window.__queryPickers?.start?.setStation(end);
    if (start) window.__queryPickers?.end?.setStation(start);
    markRouteStale();
    if (start && end && isDataReady) getRoute();
}

function resolvePickerStation(inputId) {
    const input = document.getElementById(inputId);
    if (window.__queryPickers) {
        const picker = inputId.includes('start') ? window.__queryPickers.start : window.__queryPickers.end;
        return picker?.resolve() || '';
    }
    const inputValue = input.value.trim();
    if (input.dataset.station && stationData[input.dataset.station]) return input.dataset.station;
    if (stationData && stationData[inputValue]) return inputValue;

    return '';
}

// 设置出行模式
function setTravelRequirement(mode) {
    const previousRequirement = travelRequirement;
    // 根据用户选择的模式更新 travelRequirement 变量
    if (mode === 'shortestTime') {
        travelRequirement = '最短时间';
    } else if (mode === 'leastTransfers') {
        travelRequirement = '最少换乘';
    } else {
        // 若传入无效的模式，则在控制台输出错误信息并返回
        console.error('Invalid travel requirement:', mode);
        return;
    }
    console.log('Travel requirement set to:', travelRequirement);

    const shortestBtn = document.getElementById('btn-shortest');
    const transfersBtn = document.getElementById('btn-transfers');
    if (shortestBtn && transfersBtn) {
        shortestBtn.classList.toggle('is-selected', mode === 'shortestTime');
        transfersBtn.classList.toggle('is-selected', mode === 'leastTransfers');
        shortestBtn.setAttribute('aria-pressed', String(mode === 'shortestTime'));
        transfersBtn.setAttribute('aria-pressed', String(mode === 'leastTransfers'));
    }
    if (previousRequirement !== travelRequirement) markRouteStale();
}

// 为换乘站分配权重
function assignTransferWeights(adjacencyList) {
    transferWeights = {};
    // 遍历地铁图的邻接表中的每一个站点
    for (const station in adjacencyList) {
        // 获取当前站点连接的所有线路的集合，Set 去重
        const linesAtStation = new Set(adjacencyList[station].map(n => n.line));
        // 如果线路数量大于 1，则认为是换乘站，权重为 1，否则权重为0
        transferWeights[station] = linesAtStation.size > 1 ? 1 : 0;
    }
    return transferWeights; // 返回包含每个站点换乘权重的对象
}

function loadStationDataset() {
    if (window.TransitAPI?.loadStations) return window.TransitAPI.loadStations();
    return fetch('data/_station.json').then(response => {
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return response.json();
    });
}

function loadPinyinDataset() {
    if (window.TransitAPI?.loadPinyin) return window.TransitAPI.loadPinyin();
    return fetch('data/station_pinyin.json')
        .then(response => (response.ok ? response.json() : {}))
        .catch(() => ({}));
}

// 使用Promise加载地铁时刻表和站点信息数据
Promise.all([
    loadTimetableData(),
    loadStationDataset(),
    loadPinyinDataset()
])
    .then(([timetable, stations, pinyinMap]) => {
        // 当两个Promise都成功resolved后，将返回的数据分别赋值给timetableData和stationData
        timetableData = timetable;
        stationData = stations;
        stationPinyinMap = pinyinMap || {};
        stationPickerIndex = buildStationPickerIndex(stations);
        //控制台调试测试
        console.log('Timetable lines:', Object.keys(timetable)); // 在控制台输出时刻表包含的线路名称
        console.log('Stations loaded:', Object.keys(stations)); // 在控制台输出加载的站点数量
        timetableData = normalizeTimetableData(timetable); // 调用normalizeTimetableData函数规范化时刻表数据
        subwayGraph = buildGraph(timetableData); // 调用buildGraph函数，使用加载的时刻表数据构建地铁线路图
        console.log('Stations in graph:', Object.keys(subwayGraph.adjacencyList)); // 输出地铁图中包含的站点数量
        assignTransferWeights(subwayGraph.adjacencyList); // 调用assignTransferWeights函数，为地铁图中的换乘站分配权重
        setDataReadyState(true);
        setupStationPickers();
    })
    .catch(error => {
        // 如果在加载或解析数据过程中发生错误，则在控制台输出错误信息
        console.error('Error loading data:', error);
        const resultDiv = document.getElementById('result');
        if (resultDiv) resultDiv.textContent = '';
        setDataReadyState(false);
        if (window.showToast) window.showToast('数据加载失败');
    });

// 规范化时刻表数据的函数
function normalizeTimetableData(data) {
    // 检查时刻表数据中是否存在名为 '工作日' 的属性
    if (data['工作日']) {
        console.log('Using workday data');
        return data['工作日'];
    }
    return data;
}

// 获取当前时间并更新显示在页面上
function updateCurrentTime() {
    const now = new Date(); // 创建一个新的Date对象，表示当前日期和时间
    const hours = String(now.getHours()).padStart(2, '0'); // 获取当前小时，格式化为两位数，前补0
    const minutes = String(now.getMinutes()).padStart(2, '0'); // 获取当前分钟，格式化为两位数
    currentTimeInMinutes = parseInt(hours) * 60 + parseInt(minutes); // 将当前小时和分钟转换为总分钟数
    const currentTimeEl = document.getElementById('current-time');
    if (currentTimeEl) currentTimeEl.textContent = `${hours}:${minutes}`; // 更新页面显示的当前时间
}

// 每隔1000毫秒调用一次updateCurrentTime函数，实现时间的实时更新
setInterval(updateCurrentTime, 1000);
updateCurrentTime(); // 在页面加载时立即调用一次，显示初始时间
setDataReadyState(false);

// 构建地铁线路图
function buildGraph(timetable) {
    const adjacencyList = {}; // 邻接表，用于存储每个站点的相邻站点和线路信息，键是站点名称，值是一个包含相邻站点信息的数组
    const edgeWeights = {}; // 边权重，用于存储站点之间travelTime，键是 `<span class="math-inline">\{station1\}\-</span>{station2}-<span class="math-inline">\{line\}\-</span>{direction}`，值是travelTime（分钟）
    const lineOfConnection = {}; // 存储连接两个站点的线路名称，键与edgeWeights相同，值是线路名称
    const ringLines = ['2号线', '10号线']; // 包含环线名称的数组，用于特殊处理环线

    // 如果传入的时刻表数据无效，输出错误并返回空图
    if (!timetable || typeof timetable !== 'object') {
        console.error('Invalid timetable data:', timetable);
        return { adjacencyList, edgeWeights, lineOfConnection };
    }

    // 遍历时刻表数据中的每一条线路
    for (const line in timetable) {
        console.log('Processing line:', line);
        const lineData = timetable[line]; // 获取当前线路的数据
        const directions = Object.keys(lineData || {}); // 当前线路的方向列表
        const isRing = ringLines.includes(line); // 判断当前线路是否是环线
        // 遍历当前线路的每一个方向
        for (const direction in lineData) {
            console.log(`Processing direction: ${direction} for ${line}`);
            const departures = lineData[direction]; // 获取当前方向的发车时刻表
            // 遍历每一个发车时间点
            for (const departureTime in departures) {
                const schedule = departures[departureTime]; // 获取当前发车时间的站点顺序和到站时间
                // 检查当前发车时刻表的格式是否为数组
                if (!Array.isArray(schedule)) {
                    console.warn(`Invalid schedule for ${line} ${direction} ${departureTime}`);
                    continue;
                }
                // 遍历当前时刻表中的每一个站点
                for (let i = 0; i < schedule.length - 1; i++) {
                    const station1 = schedule[i][0]; // 当前站点名称
                    const station2 = schedule[i + 1][0]; // 下一个站点名称
                    const time1 = timeStringToMinutes(schedule[i][1]); // 当前站点的到站时间（分钟）
                    const time2 = timeStringToMinutes(schedule[i + 1][1]); // 下一个站点的到站时间（分钟）
                    // 检查时间转换是否成功
                    if (isNaN(time1) || isNaN(time2)) {
                        console.warn(`Invalid time for ${station1} to ${station2}`);
                        continue;
                    }
                    let travelTime = Math.abs(time2 - time1) || 2; // 计算两个站点之间的行驶时间，如果计算结果为0或 NaN，则默认为 2 分钟
                    // 特殊处理：2号线 西直门和 积水潭区间固定行驶时间为3分钟
                    if (line === '2号线' &&
                        ((station1 === '西直门' && station2 === '积水潭') ||
                         (station1 === '积水潭' && station2 === '西直门'))) {
                        travelTime = 3;
                    }

                    // 添加邻接关系到邻接表
                    if (!adjacencyList[station1]) adjacencyList[station1] = [];
                    if (!adjacencyList[station2]) adjacencyList[station2] = [];
                    const directionKey = `${line}-${direction}`; // 构建包含线路和方向的唯一标识符
                    // 如果站点1的邻接列表中还没有包含到站点2的当前线路和方向的连接，则添加
                    if (!adjacencyList[station1].some(n => n.station === station2 && n.line === line && n.direction === directionKey)) {
                        adjacencyList[station1].push({ station: station2, line, travelTime, direction: directionKey });
                    }
                    // 如果站点2的邻接列表中还没有包含到站点1的当前线路和方向的连接，则添加
                    if (!adjacencyList[station2].some(n => n.station === station1 && n.line === line && n.direction === directionKey)) {
                        adjacencyList[station2].push({ station: station1, line, travelTime, direction: directionKey });
                    }
                    // 构建边权重的键，并存储travelTime
                    const key1 = `${station1}-${station2}-${line}-${direction}`;
                    const key2 = `${station2}-${station1}-${line}-${direction}`;
                    edgeWeights[key1] = travelTime;
                    edgeWeights[key2] = travelTime;
                    // 存储连接两个站点的线路名称
                    lineOfConnection[key1] = line;
                    lineOfConnection[key2] = line;
                }
                // 处理环线：将环线的首尾站点连接起来
                if (isRing && schedule.length > 2) {
                    const firstStation = schedule[0][0]; // 环线的第一个站点
                    const lastStation = schedule[schedule.length - 1][0]; // 环线的最后一个站点
                    let travelTime = 2; // 默认travelTime
                    const timeFirst = timeStringToMinutes(schedule[0][1]); // 第一个站点的到站时间
                    const timeLast = timeStringToMinutes(schedule[schedule.length - 1][1]); // 最后一个站点的到站时间
                    if (!isNaN(timeFirst) && !isNaN(timeLast)) {
                        travelTime = timeLast >= timeFirst ? timeLast - timeFirst : 2; // 计算旅行时间
                    }
                    // 环线上的西直门 ↔ 积水潭 特殊处理
                    if (line === '2号线' &&
                        ((firstStation === '西直门' && lastStation === '积水潭') ||
                         (firstStation === '积水潭' && lastStation === '西直门'))) {
                        travelTime = 3;
                    }

                    // 添加环线首尾站点的邻接关系
                    if (!adjacencyList[firstStation]) adjacencyList[firstStation] = [];
                    if (!adjacencyList[lastStation]) adjacencyList[lastStation] = [];

                    const directionKey = `${line}-${direction}`;
                    if (!adjacencyList[lastStation].some(n => n.station === firstStation && n.line === line && n.direction === directionKey)) {
                        adjacencyList[lastStation].push({ station: firstStation, line, travelTime, direction: directionKey });
                    }
                    if (!adjacencyList[firstStation].some(n => n.station === lastStation && n.line === line && n.direction === directionKey)) {
                        adjacencyList[firstStation].push({ station: lastStation, line, travelTime, direction: directionKey });
                    }

                    const key1 = `${lastStation}-${firstStation}-${line}-${direction}`;
                    const key2 = `${firstStation}-${lastStation}-${line}-${direction}`;
                    edgeWeights[key1] = travelTime;
                    edgeWeights[key2] = travelTime;
                    lineOfConnection[key1] = line;
                    lineOfConnection[key2] = line;
                }
            }
        }
        //对于2号线环线上的首尾站点西直门和积水潭之间的边进行处理
        if (line === '2号线') {
            const travelTime = 3;
            if (!adjacencyList['西直门']) adjacencyList['西直门'] = [];
            if (!adjacencyList['积水潭']) adjacencyList['积水潭'] = [];
            directions.forEach(dir => {
                const directionKey = `${line}-${dir}`;
                if (!adjacencyList['西直门'].some(n => n.station === '积水潭' && n.line === line && n.direction === directionKey)) {
                    adjacencyList['西直门'].push({ station: '积水潭', line, travelTime, direction: directionKey });
                }
                if (!adjacencyList['积水潭'].some(n => n.station === '西直门' && n.line === line && n.direction === directionKey)) {
                    adjacencyList['积水潭'].push({ station: '西直门', line, travelTime, direction: directionKey });
                }
                const key1 = `西直门-积水潭-${line}-${dir}`;
                const key2 = `积水潭-西直门-${line}-${dir}`;
                edgeWeights[key1] = travelTime;
                edgeWeights[key2] = travelTime;
                lineOfConnection[key1] = line;
                lineOfConnection[key2] = line;
            });
        }
    }
    // 添加换乘边：在同一个站点但属于不同线路之间添加一条虚拟边，旅行时间设置为5分钟
    for (const station in adjacencyList) {
        const linesAtStation = new Set(adjacencyList[station].map(n => n.line)); // 获取当前站点所有连接的线路
        if (linesAtStation.size > 1) {
            const linesArray = Array.from(linesAtStation); // 将线路集合转换为数组
            // 对当前站点的所有线路进行两两组合
            for (let i = 0; i < linesArray.length; i++) {
                for (let j = i + 1; j < linesArray.length; j++) {
                    const line1 = linesArray[i];
                    const line2 = linesArray[j];
                    const directionKey1 = `transfer-${line1}-${line2}`;
                    const directionKey2 = `transfer-${line2}-${line1}`;
                    // 添加从line1到line2的换乘边
                    if (!adjacencyList[station].some(n => n.station === station && n.line === line2 && n.direction === directionKey1)) {
                        adjacencyList[station].push({ station, line: line2, travelTime: 5, direction: directionKey1 });
                    }
                    // 添加从line2到line1的换乘边
                    if (!adjacencyList[station].some(n => n.station === station && n.line === line1 && n.direction === directionKey2)) {
                        adjacencyList[station].push({ station, line: line1, travelTime: 5, direction: directionKey2 });
                    }
                    const key1 = `${station}-${station}-${line1}-to-${line2}`;
                    const key2 = `${station}-${station}-${line2}-to-${line1}`;
                    edgeWeights[key1] = 5;
                    edgeWeights[key2] = 5;
                    lineOfConnection[key1] = line2;
                    lineOfConnection[key2] = line1;
                }
            }
        }
    }
    console.log('Graph built. Total stations:', Object.keys(adjacencyList).length);
    console.log('西直门 to 积水潭 edge:', adjacencyList['西直门']?.some(n => n.station === '积水潭'));
    console.log('东直门 to 积水潭 edge:', adjacencyList['东直门']?.some(n => n.station === '积水潭'));
    return { adjacencyList, edgeWeights, lineOfConnection }; // 返回构建好的地铁图数据结构
}

// 时间字符串（HH:MM）转换为分钟的函数
function timeStringToMinutes(timeStr) {
    const match = String(timeStr || '').match(/(\d{1,2}):(\d{2})/);
    if (!match) {
        console.error('Invalid time string:', timeStr);
        return NaN;
    }
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes > 59) return NaN;
    return hours * 60 + minutes;
}

// Dijkstra最短时间算法
function dijkstraShortestPath(startStation, endStation) {
    // 检查地铁图是否已经初始化
    if (!subwayGraph) {
        console.error('Subway graph not initialized.');
        return null;
    }

    // 从地铁图中获取邻接表、边权重和线路连接信息
    const { adjacencyList, edgeWeights, lineOfConnection } = subwayGraph;
    // 检查起始站和目的站是否存在于地铁图中
    if (!adjacencyList[startStation] || !adjacencyList[endStation]) {
        console.error(`Station not found: ${startStation} or ${endStation}`);
        return null;
    }

    // 初始化距离、前驱站点、使用的线路和方向等信息
    const distances = {}; // 存储从起始站到每个站点的最短时间
    const predecessors = {}; // 存储每个站点在最短路径中的前一个站点
    const linesUsed = {}; // 存储从起始站到每个站点最短路径上使用的线路
    const directionsUsed = {}; // 存储从起始站到每个站点最短路径上使用的方向
    const priorityQueue = []; // 优先队列，用于存储待访问的站点，按到达时间排序
    const visited = new Set(); // 存储已经访问过的站点

    // 初始化所有站点的距离为无穷大，前驱站点为空
    for (const station in adjacencyList) {
        distances[station] = Infinity;
        predecessors[station] = null;
        linesUsed[station] = [];
        directionsUsed[station] = [];
    }

    // 起始站的距离为0
    distances[startStation] = 0;
    // 将起始站点添加到优先队列，初始时间为0，没有前一条线路和方向，换乘次数为0
    priorityQueue.push({ station: startStation, time: 0, prevLine: null, prevDirection: null, transfers: 0 });

    // 当优先队列不为空时，继续搜索
    while (priorityQueue.length > 0) {
        // 对优先队列中的站点按总时间（如果换乘次数相同）和换乘次数进行排序，优先处理换乘次数少的，其次是时间短的
        priorityQueue.sort((a, b) => {
            if (a.time === b.time) return a.transfers - b.transfers;
            return a.time - b.time;
        });
        // 从优先队列中取出具有最小时间的站点
        const { station: currentStation, time: currentTime, prevLine, prevDirection, transfers } = priorityQueue.shift();

        // 如果当前站点已经访问过，则跳过
        if (visited.has(currentStation)) continue;
        // 将当前站点标记为已访问
        visited.add(currentStation);

        // 如果当前站点是目的站，则找到最短路径，重建路径并返回结果
        if (currentStation === endStation) {
            return {
                path: reconstructPath(predecessors, endStation), // 重建的路径（站点数组）
                totalTime: currentTime, // 总行驶时间
                lines: linesUsed[endStation], // 路径上使用的线路数组
                directions: directionsUsed[endStation], // 路径上使用的方向数组
                transfers // 总换乘次数
            };
        }

        // 遍历当前站点的所有邻接站点
        for (const neighborInfo of adjacencyList[currentStation]) {
            const neighborStation = neighborInfo.station; // 相邻站点名称
            const connectingLine = neighborInfo.line; // 连接当前站点和相邻站点的线路
            const travelTime = neighborInfo.travelTime; // 当前站点到相邻站点的旅行时间
            const direction = neighborInfo.direction; // 行驶方向

            // 如果相邻站点已经访问过，则跳过
            if (visited.has(neighborStation)) continue;

            let additionalTime = travelTime; // 从当前站点到相邻站点的基本旅行时间
            let newTransfers = transfers; // 新的换乘次数，初始值为当前站点的换乘次数
            // 如果存在上一条线路，并且上一条线路与当前连接的线路不同，则认为发生了换乘
            if (prevLine && prevLine !== connectingLine) {
                additionalTime += 5; // 增加 5 分钟的换乘时间
                newTransfers += 1; // 换乘次数加 1
            }

            // 计算到达相邻站点的新时间
            const newTime = currentTime + additionalTime;
            // 如果新的时间比之前记录的到达相邻站点的时间更短，则更新距离、前驱站点、使用的线路和方向，并将相邻站点添加到优先队列
            if (newTime < distances[neighborStation]) {
                distances[neighborStation] = newTime;
                predecessors[neighborStation] = currentStation;
                linesUsed[neighborStation] = [...linesUsed[currentStation], connectingLine]; // 复制之前的线路并添加当前线路
                directionsUsed[neighborStation] = [...directionsUsed[currentStation], direction]; // 复制之前的方向并添加当前方向
                priorityQueue.push({
                    station: neighborStation,
                    time: newTime,
                    prevLine: connectingLine,
                    prevDirection: direction,
                    transfers: newTransfers
                });
            }
        }
    }

    // 如果循环结束时仍未找到到目的站的路径，则输出错误信息并返回null
    console.error(`No path found from ${startStation} to ${endStation}`);
    return null;
}

// Dijkstra最少换乘算法
function dijkstraLeastTransfers(startStation, endStation) {
    // 检查地铁图是否已经初始化
    if (!subwayGraph) {
        console.error('Subway graph not initialized.');
        return null;
    }

    // 从地铁图中获取邻接表
    const { adjacencyList } = subwayGraph;
    // 检查起始站和目的站是否存在于地铁图中
    if (!adjacencyList[startStation] || !adjacencyList[endStation]) {
        console.error(`Station not found: ${startStation} or ${endStation}`);
        return null;
    }

    // 初始化距离、换乘次数、前驱站点、使用的线路和方向等信息
    const distances = {}; // 存储从起始站到每个站点的最短时间
    const lineChangeCounts = {}; // 存储从起始站到每个站点的最少换乘次数
    const predecessors = {}; // 存储每个站点在最少换乘路径中的前一个站点
    const linesUsed = {}; // 存储从起始站到每个站点最少换乘路径上使用的线路
    const directionsUsed = {}; // 存储从起始站到每个站点最少换乘路径上使用的方向
    const priorityQueue = []; // 优先队列，用于存储待访问的站点，按换乘次数和到达时间排序
    const visited = new Set(); // 存储已经访问过的站点

    // 初始化所有站点的距离为无穷大，换乘次数为无穷大，前驱站点为空
    for (const station in adjacencyList) {
        distances[station] = Infinity;
        lineChangeCounts[station] = Infinity;
        predecessors[station] = null;
        linesUsed[station] = [];
        directionsUsed[station] = [];
    }

    // 起始站的距离为0，换乘次数为0
    distances[startStation] = 0;
    lineChangeCounts[startStation] = 0;
    // 将起始站点添加到优先队列，初始换乘次数为0，时间为0，没有前一条线路和方向
    priorityQueue.push({
        station: startStation,
        lineChangeCount: 0,
        time: 0,
        prevLine: null,
        prevDirection: null
    });

    // 当优先队列不为空时
    while (priorityQueue.length > 0) {
        // 对优先队列中的站点按换乘次数和总时间进行排序
        priorityQueue.sort((a, b) => {
            if (a.lineChangeCount !== b.lineChangeCount) return a.lineChangeCount - b.lineChangeCount;
            return a.time - b.time;
        });

        // 从优先队列中取出具有最小换乘次数的站点
        const { station: currentStation, lineChangeCount: currentLineChangeCount, time: currentTime, prevLine, prevDirection } = priorityQueue.shift();

        // 如果当前站点已经访问过，则跳过
        if (visited.has(currentStation)) continue;
        // 标记为已访问
        visited.add(currentStation);

        // 如果当前站点是目的站，则找到最少换乘路径，重建路径并返回结果
        if (currentStation === endStation) {
            const path = reconstructPath(predecessors, endStation);
            return {
                path, // 重建的路径（站点数组）
                totalTime: currentTime, // 总旅行时间
                lines: linesUsed[endStation], // 路径上使用的线路数组
                directions: directionsUsed[endStation], // 路径上使用的方向数组
                transfers: currentLineChangeCount // 总换乘次数
            };
        }

        // 遍历当前站点的所有邻接站点
        for (const neighborInfo of adjacencyList[currentStation]) {
            const neighborStation = neighborInfo.station; // 相邻站点名称
            const connectingLine = neighborInfo.line; // 连接当前站点和相邻站点的线路
            const travelTime = neighborInfo.travelTime; // 当前站点到相邻站点的行驶时间
            const direction = neighborInfo.direction; // 行驶方向

            // 如果相邻站点已经访问过，则跳过
            if (visited.has(neighborStation)) continue;

            // 判断是否发生了换乘
            const isTransfer = prevLine && prevLine !== connectingLine;
            const newLineChangeCount = currentLineChangeCount + (isTransfer ? 1 : 0); // 如果换乘，换乘次数加1
            const newTime = currentTime + travelTime + (isTransfer ? 5 : 0); // 计算到达相邻站点的新静态时间，换乘时统一计入 5 分钟

            // 如果在新的路径的换乘次数更少，或者换乘次数相同但时间更短时，更新信息
            if (
                newLineChangeCount < lineChangeCounts[neighborStation] ||
                (newLineChangeCount === lineChangeCounts[neighborStation] && newTime < distances[neighborStation])
            ) {
                distances[neighborStation] = newTime;
                lineChangeCounts[neighborStation] = newLineChangeCount;
                predecessors[neighborStation] = currentStation;
                linesUsed[neighborStation] = [...linesUsed[currentStation], connectingLine]; // 复制之前的线路并添加当前线路
                directionsUsed[neighborStation] = [...directionsUsed[currentStation], direction]; // 复制之前的方向并添加当前方向
                priorityQueue.push({
                    station: neighborStation,
                    lineChangeCount: newLineChangeCount,
                    time: newTime,
                    prevLine: connectingLine,
                    prevDirection: direction
                });
            }
        }
    }

    // 如果循环结束时仍未找到到目的站的路径，则输出错误信息并返回 null
    console.error(`No path found from ${startStation} to ${endStation}`);
    return null;
}

// 用于从前驱站点信息中重建路径的辅助函数
function reconstructPath(predecessors, endStation) {
    const path = [];
    let current = endStation; // 从目的站开始回溯
    while (current !== null) {
        path.unshift(current); // 将当前站点添加到路径的开头
        current = predecessors[current]; // 移动到前一个站点
    }
    return path; // 返回重建的路径（站点数组）
}


// 计算实际出行时间和每站到站时间的函数
function calculateActualTime(startStation, endStation, path, currentTimeInMinutes, plannedLines = []) {
    // 如果路径为空或只有一个站点，则返回null
    if (!path || path.length < 2) return null;

    let currentTime = currentTimeInMinutes; // 初始化当前时间为查询时的当前时间
    const segments = []; // 存储每一段行程的详细信息（起始站, 目的站, 线路, 出发时间, 到达时间）
    const stationTimes = [{ station: startStation, time: currentTime }]; // 存储每个站点的到达时间，初始包含起始站和出发时间
    let prevLine = null; // 上一段行程的线路，用于判断是否需要换乘

    // 遍历路径中的每一段（从起始站到倒数第二个站）
    for (let i = 0; i < path.length - 1; i++) {
        const fromStation = path[i]; // 当前段的起始站
        const toStation = path[i + 1]; // 当前段的目的站
        const plannedEdge = (subwayGraph?.adjacencyList?.[fromStation] || []).find((edge) => (
            edge.station === toStation && (!plannedLines[i] || edge.line === plannedLines[i])
        ));
        const plannedLine = plannedLines[i] || plannedEdge?.line || prevLine;
        const staticSegmentMinutes = Number(plannedEdge?.travelTime) || 2;
        // 查找从当前起始站到目的站的下一班符合条件的列车
        const nextDeparture = findNextDeparture(fromStation, toStation, currentTime, prevLine, plannedLine);
        // 如果没有找到合适的发车信息
        if (!nextDeparture) {
            console.warn(`No timetable data for ${fromStation} to ${toStation}, estimating 2 minutes`);
            const estimatedArrival = currentTime + staticSegmentMinutes;
            segments.push({
                from: fromStation,
                to: toStation,
                line: plannedLine || '未知线路',
                departure: currentTime,
                arrival: estimatedArrival,
                estimated: true
            });
            currentTime = estimatedArrival; // 更新当前时间为到达时间
        } else {
            // 如果找到了发车信息
            const resolvedLine = nextDeparture.line === '未知线路'
                ? (plannedLine || nextDeparture.line)
                : nextDeparture.line;
            const resolvedArrival = nextDeparture.estimated
                ? currentTime + staticSegmentMinutes
                : nextDeparture.arrivalMinutes;
            segments.push({
                from: fromStation,
                to: toStation,
                line: resolvedLine,
                departure: nextDeparture.departureMinutes,
                arrival: resolvedArrival,
                estimated: Boolean(nextDeparture.estimated)
            });
            currentTime = resolvedArrival; // 更新当前时间为到达时间
        }
        stationTimes.push({ station: toStation, time: currentTime }); // 记录到达目的站的时间
        prevLine = segments[segments.length - 1].line || prevLine; // 更新上一段行程的线路
    }

    return {
        path, // 完整的路径
        startTime: segments[0].departure, // 预计出发时间
        endTime: segments[segments.length - 1].arrival, // 预计到达时间
        segments, // 每一段行程的详细信息
        stationTimes, // 每个站点的到达时间
        hasEstimatedSegments: segments.some((segment) => segment.estimated)
    };
}

// 查找下一班符合条件的列车的函数
function findNextDeparture(fromStation, toStation, currentTimeInMinutes, prevLine, preferredLine) {
    let earliestDeparture = Infinity; // 初始化最早的出发时间为无穷大
    let result = null; // 用于存储找到的下一班列车的信息

    // 优先考虑2号线
    const lines = preferredLine && timetableData[preferredLine]
        ? [preferredLine]
        : ['2号线', ...Object.keys(timetableData).filter(l => l !== '2号线')];
    for (const line of lines) {
        if (!timetableData[line]) continue; // 如果当前线路没有时刻表数据，则跳过
        const isTransfer = prevLine && prevLine !== line; // 判断是否需要换乘
        const searchTime = isTransfer ? currentTimeInMinutes + 5 : currentTimeInMinutes; // 如果需要换乘加5分钟
        for (const direction in timetableData[line]) {
            for (const departureTimeKey in timetableData[line][direction]) {
                const segments = timetableData[line][direction][departureTimeKey];
                let fromIndex = -1;
                let toIndex = -1;
                // 在当前线路和方向的时刻表中查找起始站和目的站的索引
                for (let i = 0; i < segments.length; i++) {
                    if (segments[i][0] === fromStation) fromIndex = i;
                    if (segments[i][0] === toStation) toIndex = i;
                }
                // 如果起始站和目的站都在当前线路的当前方向上，并且目的站在起始站之后，确保列车朝向目的地方向行驶
                if (fromIndex !== -1 && toIndex !== -1 && toIndex > fromIndex) {
                    let departureMinutes = timeStringToMinutes(segments[fromIndex][1]); // 获取出发站点的出发时间（分钟）
                    let arrivalMinutes = timeStringToMinutes(segments[toIndex][1]); // 获取目的站点的到达时间（分钟）
                    // 检查出发时间是否不为NaN且晚于当前时间（考虑换乘等待时间），且到达时间不为NaN
                    if (
                        !isNaN(departureMinutes) &&
                        departureMinutes >= searchTime &&
                        !isNaN(arrivalMinutes)
                    ) {
                        // 特殊处理2号线 西直门 ↔ 积水潭 行驶时间为3分钟
                        if (line === '2号线' &&
                            ((fromStation === '西直门' && toStation === '积水潭') ||
                             (fromStation === '积水潭' && toStation === '西直门'))) {
                            arrivalMinutes = departureMinutes + 3;
                        }
                        // 如果当前找到的班次比之前找到的更早，更新结果
                        if (departureMinutes < earliestDeparture) {
                            earliestDeparture = departureMinutes;
                            result = { departureMinutes, arrivalMinutes, line }; // 存储出发时间、到达时间和线路信息
                        }
                    }
                }
	        }
	    }
	}

    if (!result) {
        console.warn(`No timetable data for ${fromStation} to ${toStation}, estimating 2 minutes`);
        result = {
            departureMinutes: currentTimeInMinutes,
            arrivalMinutes: currentTimeInMinutes + 2,
            line: preferredLine || prevLine || '未知线路',
            estimated: true
        };
    }
    return result; // 返回找到的下一班列车信息，如果没有找到则返回估计的信息
}

// 获取指定站点的首班车时间的函数
function getFirstTrainTime(station) {
let earliest = Infinity; // 初始化最早时间为无穷大
// 遍历所有线路
for (const line in timetableData) {
    // 遍历每个方向
    for (const direction in timetableData[line]) {
        // 遍历每个发车时间点
        for (const departureTimeKey in timetableData[line][direction]) {
            // 遍历该班次的所有站点和时间
            for (const [stationName, timeStr] of timetableData[line][direction][departureTimeKey]) {
                // 如果当前站点与查询的站点名称匹配
                if (stationName === station) {
                    const minutes = timeStringToMinutes(timeStr); // 将时间字符串转换为分钟
                    // 如果转换成功且当前时间比记录的最早时间还早，则更新最早时间
                    if (!isNaN(minutes) && minutes < earliest) {
                        earliest = minutes;
                    }
                }
            }
        }
    }
}

return earliest === Infinity ? 5 * 60 : earliest;
}

// 计算乘车票价的函数
function calculateFare(path) {
// 检查站点数据和路径是否有效
if (!stationData || !path || path.length < 2) {
    console.error('Invalid station data or path:', path);
    return 0; // 如果数据无效，返回票价为0
}

let totalDistance = 0; // 初始化总距离为0米
// 遍历路径中的每一段行程
for (let i = 0; i < path.length - 1; i++) {
    const fromStation = path[i]; // 当前段的起始站
    const toStation = path[i + 1]; // 当前段的目的站
    const stationInfo = stationData[fromStation]; // 获取起始站点的详细信息
    // 如果找不到起始站点的信息或其没有连接信息，警告并跳过
    if (!stationInfo || !stationInfo.edge) {
        console.warn(`No edge data for ${fromStation}`);
        continue;
    }
    // 在起始站点的连接信息中查找与目的站点匹配的连接
    const edge = stationInfo.edge.find(e => e.station === toStation);
    // 如果找到了连接且包含距离信息，则将距离累加到总距离中
    if (edge && edge.distance) {
        totalDistance += edge.distance;
    } else {
        console.warn(`No distance data from ${fromStation} to ${toStation}`);
    }
}

// 将总距离从米转换为千米
const distanceKm = totalDistance / 1000;

// 北京地铁的计费规则，根据行驶距离计算票价
if (distanceKm <= 6) return 3;
if (distanceKm <= 12) return 4;
if (distanceKm <= 22) return 5;
if (distanceKm <= 32) return 6;
return 6 + Math.ceil((distanceKm - 32) / 20);
}

// 重建路径的函数
function reconstructPath(predecessors, targetStation) {
const path = [];
let current = targetStation; // 从目标站点开始回溯
while (current !== null) {
    path.unshift(current); // 将当前站点添加到路径的开头
    current = predecessors[current]; // 移动到前一个站点
}
return path; // 返回重建的路径（站点数组）
}

function lineColor(lineName) {
    return window.TransitData ? window.TransitData.lineColor(lineName) : '#3c4043';
}

function simpleLineName(lineName) {
    return window.TransitData ? window.TransitData.simplifyLineName(lineName) : simplifyLineName(lineName);
}

function buildRouteLineDiagram(segments) {
    if (!segments || !segments.length) return '';
    const blocks = [];
    let current = null;
    for (const segment of segments) {
        const line = simpleLineName(segment.line);
        if (!current || current.line !== line) {
            current = {
                line,
                from: segment.from,
                to: segment.to,
                departure: segment.departure,
                arrival: segment.arrival,
                stations: [segment.from, segment.to]
            };
            blocks.push(current);
        } else {
            current.to = segment.to;
            current.arrival = segment.arrival;
            current.stations.push(segment.to);
        }
    }

    return `
        <div class="route-line-visual">
            ${blocks.map((block, index) => {
                const transfer = index > 0 ? `<span class="transfer-note">换乘${block.line} · 换乘约5分钟</span>` : '';
                const minutes = Math.max(0, block.arrival - block.departure);
                return `
                    <section class="route-line-block" style="--line-color:${lineColor(block.line)};">
                        <div class="route-line-label"><strong>${block.line}</strong><span>${minutes}分钟</span>${transfer}</div>
                        <div class="route-line-scroll">
                            <div class="route-line-content">
                                <div class="route-line-track"></div>
                                <div class="route-station-strip">
                                    ${block.stations.map((stationName, stationIndex) => `
                                        <span class="route-station${stationIndex === 0 || stationIndex === block.stations.length - 1 ? ' is-terminal' : ''}">${stationName}</span>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    </section>
                `;
            }).join('')}
        </div>
    `;
}

function countTransfersFromLines(lines) {
    return Math.max(0, simplifyLines(lines || []).length - 1);
}

function normalizeRouteMetrics(route, actualTimeResult, queryTime = currentTimeInMinutes) {
    const staticTravelMinutes = Number(route.time ?? route.totalTime ?? route.distance ?? 0);
    const hasEstimatedSegments = Boolean(actualTimeResult?.hasEstimatedSegments);
    const estimatedActualMinutes = actualTimeResult && !hasEstimatedSegments
        ? actualTimeResult.endTime - queryTime
        : null;
    const initialWaitMinutes = actualTimeResult && !hasEstimatedSegments
        ? Math.max(0, actualTimeResult.startTime - queryTime)
        : null;
    return {
        path: route.path,
        staticTravelMinutes,
        transferCount: countTransfersFromLines(route.lines),
        estimatedDepartureTime: actualTimeResult ? actualTimeResult.startTime : null,
        estimatedArrivalTime: actualTimeResult ? actualTimeResult.endTime : null,
        estimatedActualMinutes,
        initialWaitMinutes,
        queryTime,
        hasEstimatedSegments,
        actualTimeResult
    };
}

function renderRouteState(title, detail, type = 'info') {
    const resultDiv = document.getElementById('result');
    if (!resultDiv) return;
    const notice = document.getElementById('route-stale-message');
    if (hasRouteResult && notice) {
        notice.textContent = `${title}：${detail} 下方保留上次方案，请重新查询。`;
        notice.hidden = false;
        return;
    }
    resultDiv.innerHTML = `
        <section class="result-state is-${type}" role="status">
            <strong>${title}</strong>
            <span>${detail}</span>
        </section>
    `;
}

function saveRecentRoute(start, end, mode) {
    try {
        const existing = JSON.parse(localStorage.getItem(RECENT_ROUTE_KEY) || '[]');
        const safeExisting = Array.isArray(existing) ? existing : [];
        const next = [
            { start, end, mode, time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }) },
            ...safeExisting.filter((item) => item?.start !== start || item?.end !== end),
        ].slice(0, 6);
        localStorage.setItem(RECENT_ROUTE_KEY, JSON.stringify(next));
    } catch (_) {
        // Browsers can disable storage; route planning must still work.
    }
}

// 查询地铁路线的函数
function getRoute() {
updateCurrentTime();
const queryTime = currentTimeInMinutes;
const startStation = resolvePickerStation('start-station'); // 获取用户输入或选择的起始站
const endStation = resolvePickerStation('end-station'); // 获取用户输入或选择的目的站

// 检查是否输入了起始站和目的站
if (!startStation || !endStation) {
    renderRouteState('还不能开始查询', '请从候选列表中分别选择出发站和目的站。', 'warning');
    return;
}

if (startStation === endStation) {
    renderRouteState('起终点相同', '请选择另一个目的站，或使用交换按钮调整行程。', 'warning');
    return;
}

// 检查地铁图和时刻表是否已加载
if (!isDataReady || !subwayGraph || !timetableData) {
    renderRouteState('数据仍在加载', '站点与时刻表准备完成后即可查询。', 'warning');
    return;
}

console.log(`Querying route from ${startStation} to ${endStation} with requirement: ${travelRequirement}`);

const resultDiv = document.getElementById('result'); // 获取用于显示结果的HTML元素
let routeResult = null; // 用于存储路线查询结果

// 根据用户选择的出行偏好调用不同的Dijkstra算法
if (travelRequirement === '最短时间') {
    routeResult = dijkstraShortestPath(startStation, endStation);
} else {
    routeResult = dijkstraLeastTransfers(startStation, endStation);
}

// 如果没有找到合适的路线
if (!routeResult) {
    renderRouteState('未找到可用路径', '站点仍可浏览，但当前数据可能缺少连接边或时刻表。', 'error');
    return;
}

// 计算实际出行时间
const actualTime = calculateActualTime(
    startStation,
    endStation,
    routeResult.path,
    currentTimeInMinutes,
    routeResult.lines || []
);
// 如果无法计算实际时间
if (!actualTime) {
    renderRouteState('无法估算当前行程', '路线存在，但对应时段缺少可用时刻表。', 'error');
    return;
}

// 计算票价
const fare = calculateFare(routeResult.path);
const routeMetrics = normalizeRouteMetrics(routeResult, actualTime, queryTime);
// 从实际出行时间结果中提取路径、出发时间、到达时间、行程段和每站到达时间
const { path, startTime, endTime, segments, stationTimes } = actualTime;
// 简化显示的线路信息
const simplifiedLines = simplifyLines(segments.map(s => s.line));
// 计算换乘次数
const transferCount = routeMetrics.transferCount;
saveRecentRoute(startStation, endStation, travelRequirement === '最少换乘' ? 'leastTransfers' : 'shortestTime');

// 构建每站到站时间的HTML
let stationTimesHTML = '';
if (routeMetrics.hasEstimatedSegments) {
    stationTimesHTML = `
        <section class="result-state is-warning">
            <strong>当前时刻暂无可用班次</strong>
            <span>线路与静态耗时仍可参考；预计出发、到达和逐站时刻不作推测。</span>
        </section>
    `;
} else {
    stationTimesHTML = '<div class="route-path-card"><strong>每站到站时间</strong><ul class="station-time-list">';
    stationTimes.forEach(({ station, time }) => {
        stationTimesHTML += `<li><span>${station}</span><strong>${minutesToTimeString(time)}</strong></li>`;
    });
    stationTimesHTML += '</ul></div>';
}

// 将查询结果显示在页面上
resultDiv.innerHTML = `
    <div class="route-path-card route-result-head">
        <div>
            <div class="pill">${travelRequirement}乘车方案</div>
            <h3>${startStation} → ${endStation}</h3>
            <p class="subtitle">${path.length - 1} 站 · 线路 ${simplifiedLines.join(' → ')}</p>
        </div>
        <div class="route-result-actions">
            <a class="btn btn-ghost" href="Map.html?station=${encodeURIComponent(startStation)}">在线路图查看</a>
            <a class="btn btn-ghost" href="fare_calculator.html?start=${encodeURIComponent(startStation)}&end=${encodeURIComponent(endStation)}">测算票价</a>
        </div>
    </div>
    <div class="route-summary">
        <div class="route-summary-card"><span class="combo-kind">预计出发</span><strong>${routeMetrics.hasEstimatedSegments ? '暂无班次' : minutesToTimeString(startTime)}</strong></div>
        <div class="route-summary-card"><span class="combo-kind">预计到达</span><strong>${routeMetrics.hasEstimatedSegments ? '--:--' : minutesToTimeString(endTime)}</strong></div>
        <div class="route-summary-card"><span class="combo-kind">静态路径耗时</span><strong>${routeMetrics.staticTravelMinutes} 分钟</strong></div>
        <div class="route-summary-card"><span class="combo-kind">从查询时刻起 · ${minutesToTimeString(queryTime)}</span><strong>${routeMetrics.estimatedActualMinutes === null ? '暂无法估算' : `${routeMetrics.estimatedActualMinutes} 分钟`}</strong><small>${routeMetrics.initialWaitMinutes === null ? '初始候车暂无法估算' : `含初始候车 ${routeMetrics.initialWaitMinutes} 分钟`}</small></div>
        <div class="route-summary-card"><span class="combo-kind">费用 / 换乘</span><strong>${fare} 元 · ${transferCount < 0 ? 0 : transferCount} 次</strong></div>
    </div>
    <div class="route-path-card"><strong>线路与站点</strong>${buildRouteLineDiagram(segments)}</div>
    <div class="route-path-card"><strong>完整路径</strong><p class="subtitle">${path.join(' → ')}</p></div>
    ${stationTimesHTML}
`;
hasRouteResult = true;
const notice = document.getElementById('route-stale-message');
if (notice) notice.hidden = true;
}

// 简化连续相同线路的函数
function simplifyLines(lines) {
// 如果线路数组为空或未定义，则返回包含“未知线路”的数组
if (!lines || lines.length === 0) return ['未知线路'];
const simplified = [lines[0]]; // 将第一条线路添加到简化后的数组
// 遍历原始线路数组，从第二条线路开始
for (let i = 1; i < lines.length; i++) {
    // 如果当前线路与简化后数组的最后一条线路不同，则将其添加到简化后的数组中
    if (lines[i] !== simplified[simplified.length - 1]) {
        simplified.push(lines[i]);
    }
}
return simplified; // 返回简化后的线路数组
}

// 将分钟数转换为 HH:MM 格式的时间字符串的函数
function minutesToTimeString(minutes) {
const hours = Math.floor(minutes / 60); // 计算小时数
const mins = minutes % 60; // 计算剩余的分钟数
// 将小时和分钟格式化为两位数，在前面补0
return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

if (typeof window !== 'undefined') {
    window.getRoute = getRoute;
    window.setTravelRequirement = setTravelRequirement;
    window.swapRouteEndpoints = swapRouteEndpoints;
    window.buildGraph = buildGraph;
    window.timeStringToMinutes = timeStringToMinutes;
    window.dijkstraShortestPath = dijkstraShortestPath;
    window.dijkstraLeastTransfers = dijkstraLeastTransfers;
}
