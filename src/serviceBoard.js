(function () {
    const state = {
        timetable: null,
        stations: null,
        summaries: [],
        selectedLine: null,
    };

    const refs = {
        search: document.getElementById('board-search'),
        day: document.getElementById('board-day'),
        lines: document.getElementById('board-lines'),
        detail: document.getElementById('board-detail'),
        metricLines: document.getElementById('metric-lines'),
        metricRunning: document.getElementById('metric-running'),
        metricStations: document.getElementById('metric-stations'),
    };

    function simplifyLineName(lineName) {
        return String(lineName || '').replace(/^地铁/, '').replace(/\(.+\)$/, '').replace(/(内环|外环)$/, '').trim();
    }

    function timeToMinutes(time) {
        if (!/^\d{2}:\d{2}$/.test(time || '')) return NaN;
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    }

    function minutesToTime(minutes) {
        const value = ((minutes % 1440) + 1440) % 1440;
        const hours = String(Math.floor(value / 60)).padStart(2, '0');
        const mins = String(value % 60).padStart(2, '0');
        return `${hours}:${mins}`;
    }

    function getCurrentMinutes() {
        const now = new Date();
        return now.getHours() * 60 + now.getMinutes();
    }

    function clearNode(node) {
        while (node.firstChild) node.removeChild(node.firstChild);
    }

    function text(tagName, value, className) {
        const node = document.createElement(tagName);
        if (className) node.className = className;
        node.textContent = value;
        return node;
    }

    function getStationsForLine(lineName) {
        const shortName = simplifyLineName(lineName);
        const stations = [];
        for (const stationName of Object.keys(state.stations || {})) {
            const lines = state.stations[stationName].lines || [];
            if (lines.some((line) => simplifyLineName(line) === shortName || line === lineName)) {
                stations.push(stationName);
            }
        }
        return stations.sort((a, b) => a.localeCompare(b, 'zh-CN'));
    }

    function summarizeLine(lineName, lineData) {
        const directionSummaries = [];
        const allTimes = [];
        const nextCandidates = [];
        const nowMinutes = getCurrentMinutes();

        for (const direction of Object.keys(lineData || {})) {
            const trains = lineData[direction];
            const departures = [];

            for (const trainNo of Object.keys(trains || {})) {
                const schedule = trains[trainNo];
                if (!Array.isArray(schedule) || !schedule.length) continue;

                const firstStation = schedule[0][0];
                const firstTime = schedule[0][1];
                const firstMinutes = timeToMinutes(firstTime);
                if (Number.isNaN(firstMinutes)) continue;

                departures.push({
                    trainNo,
                    direction,
                    firstStation,
                    firstTime,
                    firstMinutes,
                    terminalStation: schedule[schedule.length - 1][0],
                });
                allTimes.push(firstMinutes);

                if (firstMinutes >= nowMinutes) {
                    nextCandidates.push({
                        trainNo,
                        direction,
                        firstStation,
                        firstTime,
                        firstMinutes,
                        terminalStation: schedule[schedule.length - 1][0],
                    });
                }
            }

            departures.sort((a, b) => a.firstMinutes - b.firstMinutes);
            directionSummaries.push({
                direction,
                first: departures[0] || null,
                last: departures[departures.length - 1] || null,
                next: departures.filter((item) => item.firstMinutes >= nowMinutes).slice(0, 6),
                count: departures.length,
            });
        }

        allTimes.sort((a, b) => a - b);
        nextCandidates.sort((a, b) => a.firstMinutes - b.firstMinutes);

        const firstMinutes = allTimes[0];
        const lastMinutes = allTimes[allTimes.length - 1];
        const now = getCurrentMinutes();
        const status =
            Number.isNaN(firstMinutes) || Number.isNaN(lastMinutes)
                ? 'unknown'
                : now < firstMinutes
                  ? 'later'
                  : now <= lastMinutes
                    ? 'running'
                    : 'closed';

        return {
            lineName,
            stations: getStationsForLine(lineName),
            directions: directionSummaries,
            firstMinutes,
            lastMinutes,
            status,
            next: nextCandidates.slice(0, 8),
        };
    }

    function buildSummaries() {
        const dayKey = refs.day.value;
        const dayData = state.timetable[dayKey] || state.timetable['双休日'] || state.timetable['工作日'] || {};
        state.summaries = Object.keys(dayData)
            .map((lineName) => summarizeLine(lineName, dayData[lineName]))
            .sort((a, b) => simplifyLineName(a.lineName).localeCompare(simplifyLineName(b.lineName), 'zh-CN'));
        if (!state.selectedLine && state.summaries.length) state.selectedLine = state.summaries[0].lineName;
    }

    function statusLabel(status) {
        if (status === 'running') return '运行中';
        if (status === 'later') return '待开行';
        if (status === 'closed') return '已结束';
        return '待确认';
    }

    function renderMetrics(items) {
        refs.metricLines.textContent = items.length;
        refs.metricRunning.textContent = items.filter((item) => item.status === 'running').length;
        const stationSet = new Set();
        items.forEach((item) => item.stations.forEach((stationName) => stationSet.add(stationName)));
        refs.metricStations.textContent = stationSet.size;
    }

    function matchesSearch(item, keyword) {
        if (!keyword) return true;
        const lower = keyword.toLowerCase();
        return (
            item.lineName.toLowerCase().includes(lower) ||
            simplifyLineName(item.lineName).toLowerCase().includes(lower) ||
            item.stations.some((stationName) => stationName.includes(keyword)) ||
            item.next.some((departure) => departure.trainNo.includes(keyword))
        );
    }

    function renderLineList() {
        const keyword = refs.search.value.trim();
        const items = state.summaries.filter((item) => matchesSearch(item, keyword));

        clearNode(refs.lines);
        renderMetrics(items);

        if (!items.length) {
            refs.lines.appendChild(text('div', '暂无匹配线路', 'muted'));
            return;
        }

        for (const item of items) {
            const row = document.createElement('button');
            row.type = 'button';
            row.className = `line-row${item.lineName === state.selectedLine ? ' is-selected' : ''}`;

            const left = document.createElement('div');
            left.appendChild(text('div', simplifyLineName(item.lineName), 'line-row-name'));
            const timeRange =
                Number.isNaN(item.firstMinutes) || Number.isNaN(item.lastMinutes)
                    ? '无时刻'
                    : `${minutesToTime(item.firstMinutes)} - ${minutesToTime(item.lastMinutes)}`;
            left.appendChild(text('div', `${item.stations.length}站 · ${timeRange}`, 'line-row-meta'));

            const status = document.createElement('div');
            const dot = document.createElement('span');
            dot.className = `status-dot${item.status === 'closed' ? ' is-closed' : ''}${item.status === 'later' ? ' is-later' : ''}`;
            status.appendChild(dot);
            status.appendChild(document.createTextNode(statusLabel(item.status)));

            row.appendChild(left);
            row.appendChild(status);
            row.addEventListener('click', () => {
                state.selectedLine = item.lineName;
                renderLineList();
                renderDetail();
            });
            refs.lines.appendChild(row);
        }
    }

    function renderDetail() {
        const item = state.summaries.find((summary) => summary.lineName === state.selectedLine) || state.summaries[0];
        clearNode(refs.detail);

        if (!item) {
            refs.detail.appendChild(text('div', '暂无线路数据', 'muted'));
            return;
        }

        const head = document.createElement('div');
        head.className = 'detail-head';
        const titleWrap = document.createElement('div');
        titleWrap.appendChild(text('h1', simplifyLineName(item.lineName), 'title'));
        titleWrap.appendChild(text('p', `${item.stations.length}个站点 · ${statusLabel(item.status)}`, 'subtitle'));
        const openButton = document.createElement('a');
        openButton.className = 'btn btn-primary';
        openButton.href = `trains.html?line=${encodeURIComponent(simplifyLineName(item.lineName))}`;
        openButton.textContent = '查看车次';
        head.appendChild(titleWrap);
        head.appendChild(openButton);
        refs.detail.appendChild(head);

        const grid = document.createElement('div');
        grid.className = 'direction-grid';

        for (const direction of item.directions) {
            const card = document.createElement('div');
            card.className = 'direction-card';
            card.appendChild(text('div', direction.direction, 'line-row-name'));
            const first = direction.first ? direction.first.firstTime : '-';
            const last = direction.last ? direction.last.firstTime : '-';
            card.appendChild(text('div', `首班 ${first} · 末班 ${last} · ${direction.count}班`, 'line-row-meta'));

            const list = document.createElement('div');
            list.className = 'departure-list';
            const next = direction.next.length ? direction.next : [];
            if (!next.length) {
                list.appendChild(text('div', '今日后续暂无发车', 'muted'));
            } else {
                for (const departure of next) {
                    const row = document.createElement('button');
                    row.type = 'button';
                    row.className = 'departure-item';
                    row.appendChild(text('span', `${departure.trainNo} · ${departure.firstStation}`));
                    row.appendChild(text('strong', departure.firstTime));
                    row.addEventListener('click', () => renderTrainDetail(item.lineName, departure.direction, departure.trainNo));
                    list.appendChild(row);
                }
            }
            card.appendChild(list);
            grid.appendChild(card);
        }

        refs.detail.appendChild(grid);
    }

    function renderTrainDetail(lineName, direction, trainNo) {
        const dayKey = refs.day.value;
        const dayData = state.timetable[dayKey] || state.timetable['工作日'] || state.timetable['双休日'] || {};
        const schedule = dayData[lineName]?.[direction]?.[trainNo];
        clearNode(refs.detail);

        if (!Array.isArray(schedule)) {
            refs.detail.appendChild(text('div', '该车次时刻表未找到', 'muted'));
            return;
        }

        const head = document.createElement('div');
        head.className = 'detail-head';
        const titleWrap = document.createElement('div');
        titleWrap.appendChild(text('h1', `${lineName} · ${trainNo}`, 'title'));
        titleWrap.appendChild(text('p', `${direction} · ${schedule[0][0]} ${schedule[0][1]} 始发 · 终到 ${schedule[schedule.length - 1][0]}`, 'subtitle'));
        const backButton = document.createElement('button');
        backButton.type = 'button';
        backButton.className = 'btn btn-ghost';
        backButton.textContent = '返回线路看板';
        backButton.addEventListener('click', renderDetail);
        head.appendChild(titleWrap);
        head.appendChild(backButton);
        refs.detail.appendChild(head);

        const table = document.createElement('table');
        table.innerHTML = `
            <tr>
                <th>序号</th>
                <th>站点</th>
                <th>到达时间</th>
            </tr>
            ${schedule.map((stop, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${stop[0]}</td>
                    <td>${stop[1]}</td>
                </tr>
            `).join('')}
        `;
        refs.detail.appendChild(table);
    }

    function render() {
        buildSummaries();
        renderLineList();
        renderDetail();
    }

    async function init() {
        try {
            const [timetable, stationResponse] = await Promise.all([
                loadTimetableData(),
                fetch('data/_station.json'),
            ]);
            if (!stationResponse.ok) throw new Error(`station data ${stationResponse.status}`);
            state.timetable = timetable;
            state.stations = await stationResponse.json();
            refs.search.addEventListener('input', renderLineList);
            refs.day.addEventListener('change', () => {
                state.selectedLine = null;
                render();
            });
            render();
        } catch (error) {
            console.error(error);
            refs.detail.textContent = '数据加载失败';
            if (window.showToast) window.showToast('运行看板加载失败');
        }
    }

    init();
})();
