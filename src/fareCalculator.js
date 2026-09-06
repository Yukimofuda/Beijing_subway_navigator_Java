(function () {
    const refs = {
        start: document.getElementById('fare-start'),
        startMenu: document.getElementById('fare-start-menu'),
        startLine: document.getElementById('fare-start-line'),
        startLineSummary: document.getElementById('fare-start-line-summary'),
        end: document.getElementById('fare-end'),
        endMenu: document.getElementById('fare-end-menu'),
        endLine: document.getElementById('fare-end-line'),
        endLineSummary: document.getElementById('fare-end-line-summary'),
        passenger: document.getElementById('fare-passenger'),
        period: document.getElementById('fare-period'),
        calc: document.getElementById('fare-calc'),
        swap: document.getElementById('fare-swap'),
        output: document.getElementById('fare-output'),
    };

    let stationData = null;
    let startPicker = null;
    let endPicker = null;

    function km(distanceMeters) {
        return distanceMeters / 1000;
    }

    function formatMoney(value) {
        return `￥${value.toFixed(2)}`;
    }

    function baseFare(distanceKm) {
        if (distanceKm <= 6) return 3;
        if (distanceKm <= 12) return 4;
        if (distanceKm <= 22) return 5;
        if (distanceKm <= 32) return 6;
        return 6 + Math.ceil((distanceKm - 32) / 20);
    }

    function fareMultiplier() {
        let multiplier = 1;
        if (refs.passenger.value === 'student') multiplier *= 0.5;
        if (refs.passenger.value === 'concession') multiplier *= 0.75;
        if (refs.period.value === 'offpeak') multiplier *= 0.9;
        return multiplier;
    }

    function dijkstra(start, end) {
        const distances = {};
        const previous = {};
        const queue = [];
        const visited = new Set();
        for (const station of Object.keys(stationData)) {
            distances[station] = Infinity;
            previous[station] = null;
        }
        distances[start] = 0;
        queue.push(start);
        while (queue.length) {
            queue.sort((a, b) => distances[a] - distances[b]);
            const current = queue.shift();
            if (visited.has(current)) continue;
            visited.add(current);
            if (current === end) break;
            for (const edge of stationData[current].edge || []) {
                const next = edge.station;
                const candidate = distances[current] + (Number(edge.distance) || 0);
                if (candidate < distances[next]) {
                    distances[next] = candidate;
                    previous[next] = { station: current, edge };
                    queue.push(next);
                }
            }
        }
        if (!Number.isFinite(distances[end])) return null;
        const path = [];
        let cursor = end;
        while (cursor) {
            path.unshift(cursor);
            cursor = previous[cursor] ? previous[cursor].station : null;
        }
        return { path, distance: distances[end], previous };
    }

    function compressSegments(route) {
        const segments = [];
        for (let index = 1; index < route.path.length; index += 1) {
            const to = route.path[index];
            const item = route.previous[to];
            if (!item) continue;
            const line = window.TransitData.simplifyLineName(item.edge.line);
            const distance = Number(item.edge.distance) || 0;
            const last = segments[segments.length - 1];
            if (last && last.line === line) {
                last.to = to;
                last.distance += distance;
            } else {
                segments.push({ line, from: item.station, to, distance });
            }
        }
        return segments;
    }

    function renderState(title, detail, type = 'info') {
        refs.output.innerHTML = `
            <section class="result-state is-${type}" role="status">
                <strong>${title}</strong>
                <span>${detail}</span>
            </section>
        `;
    }

    function render(route) {
        const distanceKm = km(route.distance);
        const fare = baseFare(distanceKm) * fareMultiplier();
        const estimatedMinutes = Math.max(1, Math.round(distanceKm * 2.2));
        const segments = compressSegments(route);
        const start = route.path[0];
        const end = route.path[route.path.length - 1];
        refs.output.innerHTML = `
            <div class="result-heading">
                <div><span class="section-kicker">测算结果</span><h2>${start} → ${end}</h2></div>
                <span class="status-chip is-ready">${route.path.length - 1} 站 · ${Math.max(0, segments.length - 1)} 次换乘</span>
            </div>
            <div class="fare-result">
                <div class="fare-card"><div class="fare-value">${formatMoney(fare)}</div><div class="metric-label">预计票价</div></div>
                <div class="fare-card"><div class="fare-value">${distanceKm.toFixed(1)}km</div><div class="metric-label">最短距离</div></div>
                <div class="fare-card"><div class="fare-value">${estimatedMinutes}分钟</div><div class="metric-label">估算耗时</div></div>
            </div>
            <div class="route-steps">
                ${segments.map((segment) => `
                    <div class="route-step" style="border-left:8px solid ${window.TransitData.lineColor(segment.line)}">
                        <strong>${segment.line}</strong>
                        <span>${segment.from} → ${segment.to}</span>
                        <span class="muted">${km(segment.distance).toFixed(1)}km</span>
                    </div>
                `).join('')}
            </div>
            <div class="result-actions">
                <a class="btn btn-primary" href="query.html?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&auto=1">查看完整乘车方案</a>
                <a class="btn btn-ghost" href="Map.html?station=${encodeURIComponent(start)}">在线路图查看</a>
            </div>
            <details class="information-disclosure">
                <summary>票价说明</summary>
                <p>结果按当前站点距离估算，仅供出行参考；实际票价以运营方公布为准。</p>
            </details>
        `;
    }

    function calculate() {
        const start = startPicker?.resolve();
        const end = endPicker?.resolve();
        if (!stationData || !stationData[start] || !stationData[end]) {
            renderState('请选择完整站点', '需要从候选列表中选择出发站和目的站。', 'warning');
            return;
        }
        if (start === end) {
            renderState('起终点相同', '请选择不同站点后重新测算。', 'warning');
            return;
        }
        const route = dijkstra(start, end);
        if (!route) {
            renderState('暂时无法估算', '当前站点信息不足，请换一组站点重试。', 'error');
            return;
        }
        render(route);
    }

    async function init() {
        try {
            const [stations, timetable, pinyinMap] = await Promise.all([
                window.TransitAPI?.loadStations
                    ? window.TransitAPI.loadStations()
                    : fetch('data/_station.json').then((response) => {
                        if (!response.ok) throw new Error(`station data ${response.status}`);
                        return response.json();
                    }),
                loadTimetableData(),
                window.TransitAPI?.loadPinyin
                    ? window.TransitAPI.loadPinyin()
                    : fetch('data/station_pinyin.json').then((response) => response.ok ? response.json() : {}).catch(() => ({}))
            ]);
            stationData = stations;
            const index = window.TransitData.buildLineIndex(stationData, timetable, { pinyinMap });
            startPicker = window.TransitData.createStationPicker(index, stationData, {
                input: refs.start,
                menu: refs.startMenu,
                lineSelect: refs.startLine,
                lineSummary: refs.startLineSummary,
                openShowsAll: true,
                clearStationOnLineChange: true,
                autoSelectFirstStation: false
            });
            endPicker = window.TransitData.createStationPicker(index, stationData, {
                input: refs.end,
                menu: refs.endMenu,
                lineSelect: refs.endLine,
                lineSummary: refs.endLineSummary,
                openShowsAll: true,
                clearStationOnLineChange: true,
                autoSelectFirstStation: false
            });
            const params = new URLSearchParams(window.location.search);
            const start = params.get('start');
            const end = params.get('end');
            if (start && stationData[start]) startPicker.setStation(start);
            if (end && stationData[end]) endPicker.setStation(end);
            refs.calc.addEventListener('click', calculate);
            refs.swap.addEventListener('click', () => {
                const start = startPicker.resolve();
                const end = endPicker.resolve();
                if (end) startPicker.setStation(end);
                if (start) endPicker.setStation(start);
            });
            refs.passenger.addEventListener('change', calculate);
            refs.period.addEventListener('change', calculate);
            if (start && end && stationData[start] && stationData[end]) calculate();
        } catch (error) {
            console.error(error);
            renderState('暂时无法载入', '请稍后刷新页面重试。', 'error');
        }
    }

    init();
})();
