(function () {
    const refs = {
        search: document.getElementById('station-guide-search'),
        list: document.getElementById('station-guide-list'),
        detail: document.getElementById('station-guide-detail'),
    };

    const state = {
        stations: null,
        timetable: null,
        selected: null,
    };

    function simplifyLineName(lineName) {
        return String(lineName || '').replace(/^地铁/, '').replace(/\(.+\)$/, '').replace(/(内环|外环)$/, '').trim();
    }

    function clearNode(node) {
        while (node.firstChild) node.removeChild(node.firstChild);
    }

    function node(tagName, value, className) {
        const element = document.createElement(tagName);
        if (className) element.className = className;
        element.textContent = value;
        return element;
    }

    function stationMatches(stationName, keyword) {
        if (!keyword) return true;
        const info = state.stations[stationName];
        return stationName.includes(keyword) || (info.lines || []).some((line) => simplifyLineName(line).includes(keyword) || line.includes(keyword));
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

    function renderList() {
        const keyword = refs.search.value.trim();
        const stations = Object.keys(state.stations || {})
            .filter((stationName) => stationMatches(stationName, keyword))
            .sort((a, b) => a.localeCompare(b, 'zh-CN'));

        clearNode(refs.list);
        if (!stations.length) {
            refs.list.appendChild(node('div', '暂无匹配站点', 'muted'));
            return;
        }

        for (const stationName of stations.slice(0, 120)) {
            const info = state.stations[stationName];
            const row = document.createElement('button');
            row.type = 'button';
            row.className = `station-row${stationName === state.selected ? ' is-selected' : ''}`;
            row.appendChild(node('div', stationName, 'line-row-name'));
            row.appendChild(node('div', (info.lines || []).map(simplifyLineName).join(' / '), 'line-row-meta'));
            row.addEventListener('click', () => {
                state.selected = stationName;
                renderList();
                renderDetail();
            });
            refs.list.appendChild(row);
        }
    }

    function renderDetail() {
        const stationName = state.selected || Object.keys(state.stations || {})[0];
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
        left.appendChild(node('p', `${info.line_siz || (info.lines || []).length}条线路 · ${(info.edge || []).length}个相邻站`, 'subtitle'));
        const routeLink = document.createElement('a');
        routeLink.className = 'btn btn-primary';
        routeLink.href = `query.html?station=${encodeURIComponent(stationName)}`;
        routeLink.textContent = '规划路线';
        head.appendChild(left);
        head.appendChild(routeLink);
        refs.detail.appendChild(head);

        const badges = document.createElement('div');
        badges.className = 'line-badges';
        (info.lines || []).forEach((line) => {
            const badge = document.createElement('span');
            badge.className = 'pill';
            badge.textContent = simplifyLineName(line);
            badges.appendChild(badge);
        });
        refs.detail.appendChild(badges);

        const firstLast = getFirstLast(stationName);
        const grid = document.createElement('div');
        grid.className = 'station-grid';
        const first = document.createElement('div');
        first.className = 'station-tile';
        first.appendChild(node('div', firstLast.first ? firstLast.first.time : '-', 'metric-value'));
        first.appendChild(node('div', '最早到发', 'metric-label'));
        const last = document.createElement('div');
        last.className = 'station-tile';
        last.appendChild(node('div', firstLast.last ? firstLast.last.time : '-', 'metric-value'));
        last.appendChild(node('div', '最晚到发', 'metric-label'));
        const services = document.createElement('div');
        services.className = 'station-tile';
        services.appendChild(node('div', String(firstLast.count), 'metric-value'));
        services.appendChild(node('div', '匹配班次', 'metric-label'));
        grid.appendChild(first);
        grid.appendChild(last);
        grid.appendChild(services);
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
                renderList();
                renderDetail();
            });
            neighbors.appendChild(link);
        });
        refs.detail.appendChild(neighbors);
    }

    async function init() {
        try {
            const [stationResponse, timetable] = await Promise.all([
                fetch('data/_station.json'),
                loadTimetableData(),
            ]);
            if (!stationResponse.ok) throw new Error(`station data ${stationResponse.status}`);
            state.stations = await stationResponse.json();
            state.timetable = timetable;
            state.selected = Object.keys(state.stations)[0];
            refs.search.addEventListener('input', renderList);
            renderList();
            renderDetail();
        } catch (error) {
            console.error(error);
            refs.detail.textContent = '数据加载失败';
        }
    }

    init();
})();

