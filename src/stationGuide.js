(function () {
    const refs = {
        search: document.getElementById('station-guide-search'),
        menu: document.getElementById('station-guide-menu'),
        line: document.getElementById('station-guide-line'),
        lineSummary: document.getElementById('station-guide-line-summary'),
        list: document.getElementById('station-guide-list'),
        detail: document.getElementById('station-guide-detail'),
    };

    const state = {
        stations: null,
        timetable: null,
        index: null,
        picker: null,
        selected: null,
    };

    function clearNode(node) {
        while (node.firstChild) node.removeChild(node.firstChild);
    }

    function node(tagName, value, className) {
        const element = document.createElement(tagName);
        if (className) element.className = className;
        element.textContent = value;
        return element;
    }

    function getFirstLast(stationName) {
        const times = [];
        for (const dayKey of Object.keys(state.timetable || {})) {
            const day = state.timetable[dayKey];
            for (const line of Object.keys(day || {})) {
                for (const direction of Object.keys(day[line] || {})) {
                    for (const trainNo of Object.keys(day[line][direction] || {})) {
                        const stop = day[line][direction][trainNo].find((item) => item[0] === stationName);
                        if (stop) times.push({ dayKey, line, direction, trainNo, time: stop[1] });
                    }
                }
            }
        }
        times.sort((a, b) => a.time.localeCompare(b.time));
        return { first: times[0] || null, last: times[times.length - 1] || null, count: times.length };
    }

    function currentStationList() {
        const lineName = refs.line.hidden ? '' : refs.line.value;
        if (lineName) return state.index.lineMap.get(lineName)?.stations || [];
        return state.index.stations;
    }

    function renderList() {
        const stations = currentStationList();
        clearNode(refs.list);
        if (!stations.length) {
            refs.list.appendChild(node('div', '暂无匹配站点', 'muted'));
            return;
        }

        for (const stationName of stations) {
            const info = state.stations[stationName];
            const row = document.createElement('button');
            row.type = 'button';
            row.className = `station-row${stationName === state.selected ? ' is-selected' : ''}`;
            row.appendChild(node('div', stationName, 'line-row-name'));
            row.appendChild(node('div', (info.lines || []).map(window.TransitData.simplifyLineName).sort(window.TransitData.compareLines).join(' / '), 'line-row-meta'));
            row.addEventListener('click', () => {
                state.selected = stationName;
                state.picker.setStation(stationName);
                renderList();
                renderDetail();
            });
            refs.list.appendChild(row);
        }
    }

    function renderDetail() {
        const stationName = state.selected || state.picker.resolve() || currentStationList()[0];
        state.selected = stationName;
        const info = state.stations[stationName];
        clearNode(refs.detail);

        if (!info) {
            refs.detail.appendChild(node('div', '暂无站点数据', 'muted'));
            return;
        }

        const head = document.createElement('div');
        head.className = 'detail-head';
        const left = document.createElement('div');
        left.appendChild(node('h1', stationName, 'title'));
        left.appendChild(node('p', `${(info.lines || []).length}条线路 · ${(info.edge || []).length}个相邻站`, 'subtitle'));
        const routeLink = document.createElement('a');
        routeLink.className = 'btn btn-primary';
        routeLink.href = `query.html?station=${encodeURIComponent(stationName)}`;
        routeLink.textContent = '规划路线';
        head.appendChild(left);
        head.appendChild(routeLink);
        refs.detail.appendChild(head);

        const badges = document.createElement('div');
        badges.className = 'line-badges';
        window.TransitData.stationLines(state.stations, stationName).forEach((line) => {
            const badge = document.createElement('span');
            badge.className = 'pill';
            badge.style.borderColor = window.TransitData.lineColor(line);
            badge.textContent = line;
            badges.appendChild(badge);
        });
        refs.detail.appendChild(badges);

        const firstLast = getFirstLast(stationName);
        const grid = document.createElement('div');
        grid.className = 'station-grid';
        [
            [firstLast.first ? firstLast.first.time : '-', '最早到发'],
            [firstLast.last ? firstLast.last.time : '-', '最晚到发'],
            [String(firstLast.count), '匹配班次'],
            [`${Math.max(1, (info.lines || []).length + 1)}处`, '出入口估算'],
            [(info.edge || []).slice(0, 3).map((edge) => edge.station).join(' / ') || '-', '周边相邻站'],
            ['商业、学校、公园等以实际站外信息为准', '周边提示']
        ].forEach(([value, label]) => {
            const tile = document.createElement('div');
            tile.className = 'station-tile';
            tile.appendChild(node('div', value, 'metric-value'));
            tile.appendChild(node('div', label, 'metric-label'));
            grid.appendChild(tile);
        });
        refs.detail.appendChild(grid);

        const neighbors = document.createElement('div');
        neighbors.className = 'neighbor-list';
        (info.edge || []).forEach((edge) => {
            const link = document.createElement('button');
            link.type = 'button';
            link.className = 'chip';
            link.textContent = `${edge.station} · ${(Number(edge.distance) / 1000).toFixed(1)}km`;
            link.addEventListener('click', () => {
                state.selected = edge.station;
                state.picker.setStation(edge.station);
                renderList();
                renderDetail();
            });
            neighbors.appendChild(link);
        });
        refs.detail.appendChild(neighbors);
    }

    async function init() {
        try {
            const [stationResponse, timetable] = await Promise.all([fetch('data/_station.json'), loadTimetableData()]);
            if (!stationResponse.ok) throw new Error(`station data ${stationResponse.status}`);
            state.stations = await stationResponse.json();
            state.timetable = timetable;
            state.index = window.TransitData.buildLineIndex(state.stations, timetable);
            state.picker = window.TransitData.createStationPicker(state.index, state.stations, {
                input: refs.search,
                menu: refs.menu,
                lineSelect: refs.line,
                lineSummary: refs.lineSummary
            });
            state.selected = state.index.lines[0]?.stations[0] || state.index.stations[0];
            if (state.selected) state.picker.setStation(state.selected);
            refs.line.addEventListener('change', () => {
                state.selected = currentStationList()[0];
                if (state.selected) state.picker.setStation(state.selected);
                renderList();
                renderDetail();
            });
            refs.search.addEventListener('change', () => {
                const stationName = state.picker.resolve();
                if (stationName) {
                    state.selected = stationName;
                    renderList();
                    renderDetail();
                }
            });
            refs.search.addEventListener('stationchange', (event) => {
                state.selected = event.detail.station;
                renderList();
                renderDetail();
            });
            renderList();
            renderDetail();
        } catch (error) {
            console.error(error);
            refs.detail.textContent = '数据加载失败';
        }
    }

    init();
})();
