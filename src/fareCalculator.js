(function () {
    const refs = {
        start: document.getElementById('fare-start'),
        end: document.getElementById('fare-end'),
        passenger: document.getElementById('fare-passenger'),
        period: document.getElementById('fare-period'),
        calc: document.getElementById('fare-calc'),
        swap: document.getElementById('fare-swap'),
        stations: document.getElementById('fare-stations'),
        output: document.getElementById('fare-output'),
    };

    let stationData = null;

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
        const passenger = refs.passenger.value;
        const period = refs.period.value;
        let multiplier = 1;
        if (passenger === 'student') multiplier *= 0.5;
        if (passenger === 'concession') multiplier *= 0.75;
        if (period === 'offpeak') multiplier *= 0.9;
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
                const weight = Number(edge.distance) || 0;
                const candidate = distances[current] + weight;
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
            const from = item.station;
            const line = item.edge.line;
            const distance = Number(item.edge.distance) || 0;
            const last = segments[segments.length - 1];
            if (last && last.line === line) {
                last.to = to;
                last.distance += distance;
            } else {
                segments.push({ line, from, to, distance });
            }
        }
        return segments;
    }

    function render(route) {
        const distanceKm = km(route.distance);
        const fare = baseFare(distanceKm) * fareMultiplier();
        const estimatedMinutes = Math.max(1, Math.round(distanceKm * 2.2));
        const segments = compressSegments(route);

        refs.output.innerHTML = `
            <div class="fare-result">
                <div class="fare-card">
                    <div class="fare-value">${formatMoney(fare)}</div>
                    <div class="metric-label">预计票价</div>
                </div>
                <div class="fare-card">
                    <div class="fare-value">${distanceKm.toFixed(1)}km</div>
                    <div class="metric-label">最短距离</div>
                </div>
                <div class="fare-card">
                    <div class="fare-value">${estimatedMinutes}分钟</div>
                    <div class="metric-label">估算耗时</div>
                </div>
            </div>
            <div class="route-steps">
                ${segments.map((segment) => `
                    <div class="route-step">
                        <strong>${segment.line.replace(/^地铁/, '').replace(/\(.+\)$/, '')}</strong>
                        <span>${segment.from} → ${segment.to}</span>
                        <span class="muted">${km(segment.distance).toFixed(1)}km</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function calculate() {
        const start = refs.start.value.trim();
        const end = refs.end.value.trim();
        if (!stationData || !stationData[start] || !stationData[end] || start === end) {
            refs.output.textContent = '请选择有效且不同的站点';
            return;
        }

        const route = dijkstra(start, end);
        if (!route) {
            refs.output.textContent = '未找到可用路径';
            return;
        }
        render(route);
    }

    async function init() {
        try {
            const response = await fetch('data/_station.json');
            if (!response.ok) throw new Error(`station data ${response.status}`);
            stationData = await response.json();
            const stations = Object.keys(stationData).sort((a, b) => a.localeCompare(b, 'zh-CN'));
            refs.stations.innerHTML = stations.map((station) => `<option value="${station}"></option>`).join('');
            refs.calc.addEventListener('click', calculate);
            refs.swap.addEventListener('click', () => {
                const start = refs.start.value;
                refs.start.value = refs.end.value;
                refs.end.value = start;
                calculate();
            });
            refs.passenger.addEventListener('change', calculate);
            refs.period.addEventListener('change', calculate);
        } catch (error) {
            console.error(error);
            refs.output.textContent = '数据加载失败';
        }
    }

    init();
})();
