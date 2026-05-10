document.addEventListener('DOMContentLoaded', () => {
    const lineStationDetailsDiv = document.getElementById('line-station-details');
    const currentLine = localStorage.getItem('currentLine');
    const currentDirection = localStorage.getItem('currentLineDirection');
    const currentTimetableLine = localStorage.getItem('currentLineTimetableName');

    function simplifyLineName(lineName) {
        return String(lineName || '')
            .replace(/^地铁/, '')
            .replace(/\(.+\)$/, '')
            .replace(/(内环|外环)$/, '')
            .trim();
    }

    function matchesLine(lineName, targetLine) {
        return simplifyLineName(lineName) === simplifyLineName(targetLine);
    }

    function getOrderedStationsFromTimetable(timetable) {
        const dayData = timetable?.['工作日'] || timetable?.['双休日'] || timetable || {};
        const lineName = currentTimetableLine || Object.keys(dayData).find((line) => matchesLine(line, currentLine));
        const lineData = dayData[lineName];
        if (!lineData) return [];
        const directionData = lineData[currentDirection] || lineData[Object.keys(lineData)[0]];
        const firstTrain = directionData ? directionData[Object.keys(directionData)[0]] : null;
        return Array.isArray(firstTrain) ? firstTrain.map((item) => item[0]) : [];
    }

    function displayDirectionLabel(stations) {
        if (!stations.length) return currentDirection || '线路方向';
        const first = stations[0];
        const last = stations[stations.length - 1];
        const isRing = currentLine === '2号线' || currentLine === '10号线';
        if (isRing) {
            const ringLabel = /内|顺/.test(currentDirection || '') ? '顺时针' : '逆时针';
            return `${ringLabel}${first}到${last}`;
        }
        return `${first}到${last}`;
    }

    function getEdgeInfo(stationData, fromStation, toStation, targetLine) {
        const edges = stationData[fromStation]?.edge || [];
        return edges.find((edge) => edge.station === toStation && matchesLine(edge.line, targetLine));
    }

    if (!currentLine) {
        lineStationDetailsDiv.textContent = '未选择线路。';
        return;
    }

    Promise.all([
        fetch('data/_station.json').then((response) => response.json()),
        window.loadTimetableData ? window.loadTimetableData() : Promise.resolve({}),
    ])
        .then(([stationData, timetable]) => {
            const stationsOnLine = Object.keys(stationData).filter((station) =>
                (stationData[station].lines || []).some((line) => matchesLine(line, currentLine))
            );

            if (!stationsOnLine.length) {
                lineStationDetailsDiv.textContent = `未找到线路 ${currentLine} 的站点信息。`;
                return;
            }

            const orderedFromTimetable = getOrderedStationsFromTimetable(timetable).filter((stationName) => stationData[stationName]);
            const orderedStations = orderedFromTimetable.length ? orderedFromTimetable : stationsOnLine;
            let maxSpeed = '-';
            for (const stationName of stationsOnLine) {
                const edge = (stationData[stationName].edge || []).find((item) => matchesLine(item.line, currentLine));
                if (edge?.speed) {
                    maxSpeed = edge.speed;
                    break;
                }
            }

            const lineInfoDiv = document.createElement('div');
            lineInfoDiv.className = 'route-path-card';
            lineInfoDiv.innerHTML = `
                <div class="pill">${displayDirectionLabel(orderedStations)}</div>
                <h2 style="margin:10px 0 0;">${currentLine}</h2>
                <p class="subtitle">${orderedStations.length}个站点 · 最高速度 ${maxSpeed} km/h</p>
                <div class="grid">
                    <a class="btn btn-primary" href="query.html">规划该线路行程</a>
                    <a class="btn btn-ghost" href="lines.html">查看列车时刻表</a>
                    <a class="btn btn-ghost" href="station_guide.html">打开站点导览</a>
                </div>
            `;
            lineStationDetailsDiv.appendChild(lineInfoDiv);

            const table = document.createElement('table');
            let html = `
                <tr>
                    <th>本站名称</th>
                    <th>下一站名称</th>
                    <th>距离 (米)</th>
                    <th>所需时间 (秒)</th>
                </tr>
            `;

            for (let i = 0; i < orderedStations.length; i++) {
                const currentStationName = orderedStations[i];
                const nextStationName = i < orderedStations.length - 1 ? orderedStations[i + 1] : null;
                const edge = nextStationName ? getEdgeInfo(stationData, currentStationName, nextStationName, currentLine) : null;
                html += `
                    <tr>
                        <td>${currentStationName}</td>
                        <td>${nextStationName || '-'}</td>
                        <td>${edge?.distance || '-'}</td>
                        <td>${edge?.time ? edge.time.toFixed(2) : '-'}</td>
                    </tr>
                `;
            }

            table.innerHTML = html;
            lineStationDetailsDiv.appendChild(table);
        })
        .catch((error) => {
            console.error('加载站点数据失败:', error);
            lineStationDetailsDiv.textContent = '线路详情加载失败。';
        });
});
