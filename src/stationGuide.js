(function () {
    const refs = {
        search: document.getElementById('station-guide-search'),
        menu: document.getElementById('station-guide-menu'),
        line: document.getElementById('station-guide-line'),
        lineSummary: document.getElementById('station-guide-line-summary'),
        list: document.getElementById('station-guide-list'),
        detail: document.getElementById('station-guide-detail'),
        recent: document.getElementById('station-guide-recent'),
        count: document.getElementById('station-guide-count'),
    };

    const state = {
        stations: null,
        timetable: null,
        details: {},
        index: null,
        picker: null,
        selected: null,
    };
    const RECENT_KEY = 'subwayRecentStations';

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

    function readRecentStations() {
        try {
            return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').filter((stationName) => state.stations?.[stationName]).slice(0, 8);
        } catch (_) {
            return [];
        }
    }

    function saveRecentStation(stationName) {
        if (!stationName) return;
        const recent = [stationName, ...readRecentStations().filter((name) => name !== stationName)].slice(0, 8);
        try {
            localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
        } catch (_) {
            return;
        }
        renderRecentStations();
    }

    function renderRecentStations() {
        if (!refs.recent) return;
        clearNode(refs.recent);
        const recent = readRecentStations();
        if (!recent.length) {
            refs.recent.appendChild(node('span', '暂无记录', 'muted'));
            return;
        }
        recent.forEach((stationName) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'chip';
            button.textContent = stationName;
            button.addEventListener('click', () => selectStation(stationName));
            refs.recent.appendChild(button);
        });
    }

    function selectStation(stationName) {
        if (!state.stations?.[stationName]) return;
        state.selected = stationName;
        state.picker.setStation(stationName);
        renderList();
        renderDetail();
    }

    function createLink(label, href, className = 'btn btn-ghost') {
        const link = document.createElement('a');
        link.className = className;
        link.href = href;
        link.target = href.startsWith('http') ? '_blank' : '_self';
        link.rel = href.startsWith('http') ? 'noopener' : '';
        link.textContent = label;
        return link;
    }

    function normalizeFacilityItems(items) {
        if (!items) return [];
        if (Array.isArray(items)) return items.map((item) => String(item || '').trim()).filter(Boolean);
        return [String(items).trim()].filter(Boolean);
    }

    function renderFacilityGroup(title, items) {
        const list = normalizeFacilityItems(items);
        if (!list.length) return null;
        const group = document.createElement('section');
        group.className = 'station-facility-group';
        group.appendChild(node('h4', title));
        const ul = document.createElement('ul');
        list.forEach((item) => {
            ul.appendChild(node('li', item));
        });
        group.appendChild(ul);
        return group;
    }

    function renderFacilitySource(source) {
        if (!source) return null;
        const sourceNode = document.createElement('p');
        sourceNode.className = 'station-data-source';
        const provider = source.provider || '公开站点信息';
        const updatedAt = source.updatedAt || '未知';
        sourceNode.appendChild(document.createTextNode(`数据来源：${provider}，更新日期：${updatedAt}`));
        if (source.url) {
            sourceNode.appendChild(document.createTextNode(' · '));
            sourceNode.appendChild(createLink('查看来源', source.url, 'chip'));
        }
        return sourceNode;
    }

    function renderFacilitySection(detail) {
        const section = document.createElement('section');
        section.className = 'station-facilities';
        section.appendChild(node('h3', '站内设施', 'section-title'));

        if (!detail?.facilities) {
            section.appendChild(node('p', '暂无详细站内设施数据。', 'muted'));
            return section;
        }

        const facilities = detail.facilities;
        const grid = document.createElement('div');
        grid.className = 'station-facility-grid';
        [
            ['卫生间', facilities.toilet],
            ['无障碍卫生间', facilities.accessibleToilet],
            ['直升电梯', facilities.elevator],
            ['坡道', facilities.ramp],
            ['AED', facilities.aed],
            ['自动售票机', facilities.ticketMachine],
            ['乘客服务中心', facilities.serviceCenter],
            ['警务室', facilities.policeOffice],
            ['综合售货机', facilities.vendingMachine],
            ['自动售水机', facilities.waterMachine],
            ['寄存柜', facilities.locker],
            ['共享充电宝', facilities.powerBank]
        ].forEach(([title, items]) => {
            const group = renderFacilityGroup(title, items);
            if (group) grid.appendChild(group);
        });

        if (grid.childElementCount) {
            section.appendChild(grid);
        } else {
            section.appendChild(node('p', '暂无详细站内设施数据。', 'muted'));
        }

        const source = renderFacilitySource(detail.source);
        if (source) section.appendChild(source);
        return section;
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
            row.addEventListener('click', () => selectStation(stationName));
            refs.list.appendChild(row);
        }
    }

    function renderRealStationInfo(stationName, adjacency) {
        const detail = state.details?.[stationName];
        const section = document.createElement('section');
        section.className = 'station-source-panel';

        const header = document.createElement('div');
        header.className = 'source-panel-head';
        const titleWrap = document.createElement('div');
        titleWrap.appendChild(node('h2', '站内导览与周边', 'section-title'));
        titleWrap.appendChild(node('p', detail ? '已收录的站内设施与周边信息' : '当前本地数据尚未收录该站的核验详情', 'muted'));
        header.appendChild(titleWrap);
        header.appendChild(createLink('打开官方查询', detail?.officialLookupUrl || 'https://www.bjsubway.com/station/xltcx/'));
        section.appendChild(header);

        if (detail?.guideMapUrl) {
            const mapLink = document.createElement('a');
            mapLink.className = 'guide-map-card';
            mapLink.href = detail.guideMapUrl;
            mapLink.target = '_blank';
            mapLink.rel = 'noopener';
            const image = document.createElement('img');
            image.src = detail.guideMapUrl;
            image.alt = `${stationName}站内导览图`;
            image.loading = 'lazy';
            mapLink.appendChild(image);
            mapLink.appendChild(node('span', '查看官方站内导览图', 'metric-label'));
            section.appendChild(mapLink);
        }

        const facts = document.createElement('div');
        facts.className = 'station-fact-grid';
        [
            [detail?.knownExits?.length ? detail.knownExits.join(' / ') : '暂无核验数据', '出入口'],
            [detail?.exitCountText || '暂无核验数据', '出口数量'],
            [detail?.nearby?.join(' / ') || '暂无核验数据', '周边地点'],
            [detail?.services?.join(' / ') || '暂无核验数据', '站内服务']
        ].forEach(([value, label]) => {
            const tile = document.createElement('div');
            tile.className = 'station-tile';
            tile.appendChild(node('div', value, 'metric-value compact'));
            tile.appendChild(node('div', label, 'metric-label'));
            facts.appendChild(tile);
        });
        section.appendChild(facts);
        section.appendChild(renderFacilitySection(detail));

        if (detail?.tips) {
            const tips = document.createElement('div');
            tips.className = 'station-note';
            tips.textContent = detail.tips;
            section.appendChild(tips);
        }

        const sourceLinks = document.createElement('div');
        sourceLinks.className = 'source-links';
        if (detail?.sourceUrl) sourceLinks.appendChild(createLink(detail.sourceName || '来源页面', detail.sourceUrl, 'chip'));
        sourceLinks.appendChild(createLink('站点及周边信息总入口', 'https://www.bjsubway.com/station/xltcx/', 'chip'));
        sourceLinks.appendChild(createLink('在地图中查看', `Map.html?station=${encodeURIComponent(stationName)}`, 'chip'));
        sourceLinks.appendChild(createLink('作为起点规划', `query.html?start=${encodeURIComponent(stationName)}`, 'chip'));
        section.appendChild(sourceLinks);

        if (adjacency.length) {
            const nearbyActions = document.createElement('div');
            nearbyActions.className = 'source-links';
            adjacency.slice(0, 4).forEach((item) => {
                [item.previous, item.next].filter(Boolean).forEach((nearbyStation) => {
                    if (nearbyActions.querySelector(`[data-nearby="${nearbyStation}"]`)) return;
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'chip';
                    button.dataset.nearby = nearbyStation;
                    button.textContent = `相邻站：${nearbyStation}`;
                    button.addEventListener('click', () => selectStation(nearbyStation));
                    nearbyActions.appendChild(button);
                });
            });
            if (nearbyActions.childElementCount) section.appendChild(nearbyActions);
        }

        refs.detail.appendChild(section);
    }

    function renderDetail() {
        const stationName = state.selected || state.picker.resolve();
        const info = state.stations[stationName];
        clearNode(refs.detail);

        if (!info) {
            refs.detail.appendChild(node('div', stationName ? '未找到该站点，请检查 data/_station.json' : '请选择站点查看导览信息', 'muted'));
            return;
        }
        state.selected = stationName;
        saveRecentStation(stationName);

        const head = document.createElement('div');
        head.className = 'detail-head';
        const left = document.createElement('div');
        left.appendChild(node('h1', stationName, 'title'));
        const adjacency = window.TransitData.lineSegmentsForStation(state.index, stationName);
        const adjacentStationCount = new Set(adjacency.flatMap((item) => [item.previous, item.next]).filter(Boolean)).size;
        left.appendChild(node('p', `${(info.lines || []).length}条线路 · ${adjacentStationCount}个相邻站`, 'subtitle'));
        const routeLink = document.createElement('a');
        routeLink.className = 'btn btn-primary';
        routeLink.href = `query.html?start=${encodeURIComponent(stationName)}`;
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
            [firstLast.first ? firstLast.first.time : '暂无时刻数据', '最早到发'],
            [firstLast.last ? firstLast.last.time : '暂无时刻数据', '最晚到发'],
            [String(firstLast.count), '匹配班次'],
            [state.details?.[stationName]?.exitCountText || '暂无核验数据', '出口数量'],
            [Array.from(new Set(adjacency.flatMap((item) => [item.previous, item.next]).filter(Boolean))).slice(0, 4).join(' / ') || '暂无相邻站数据', '相邻站'],
            [state.details?.[stationName]?.nearby?.join(' / ') || '暂无核验数据', '周边地点']
        ].forEach(([value, label]) => {
            const tile = document.createElement('div');
            tile.className = 'station-tile';
            const valueClass = String(value).length > 10 ? 'metric-value compact' : 'metric-value';
            tile.appendChild(node('div', value, valueClass));
            tile.appendChild(node('div', label, 'metric-label'));
            grid.appendChild(tile);
        });
        refs.detail.appendChild(grid);

        const actions = document.createElement('div');
        actions.className = 'station-actions';
        [
            ['设为起点', `query.html?start=${encodeURIComponent(stationName)}`],
            ['设为终点', `query.html?end=${encodeURIComponent(stationName)}`],
            ['测算票价', `fare_calculator.html?start=${encodeURIComponent(stationName)}`],
            ['查看线路图', `Map.html?station=${encodeURIComponent(stationName)}`]
        ].forEach(([label, href]) => {
            const link = document.createElement('a');
            link.className = label === '设为起点' ? 'btn btn-primary' : 'btn btn-ghost';
            link.href = href;
            link.textContent = label;
            actions.appendChild(link);
        });
        refs.detail.appendChild(actions);
        renderRealStationInfo(stationName, adjacency);

        const adjacencyWrap = document.createElement('div');
        adjacencyWrap.className = 'adjacency-grid';
        adjacency.forEach((item) => {
            const card = document.createElement('div');
            card.className = 'adjacency-card';
            card.style.setProperty('--line-color', item.color);
            card.innerHTML = `
                <div class="adjacency-card-title">
                    <span>${item.line}</span>
                    <span class="muted">第 ${item.index} / ${item.total} 站</span>
                </div>
                <div class="adjacency-flow">
                    <button class="chip" type="button" data-station="${item.previous || ''}" ${item.previous ? '' : 'disabled'}>${item.previous || '始发端'}</button>
                    <span>→</span>
                    <strong>${item.current}</strong>
                    <span>→</span>
                    <button class="chip" type="button" data-station="${item.next || ''}" ${item.next ? '' : 'disabled'}>${item.next || '终点端'}</button>
                </div>
            `;
            card.querySelectorAll('[data-station]').forEach((button) => {
                button.addEventListener('click', () => {
                    const nextStation = button.dataset.station;
                    if (!nextStation) return;
                    selectStation(nextStation);
                });
            });
            adjacencyWrap.appendChild(card);
        });
        if (!adjacency.length) adjacencyWrap.appendChild(node('div', '暂无相邻站数据。', 'result-state'));
        refs.detail.appendChild(adjacencyWrap);
    }

    async function init() {
        try {
            const [stations, timetable, details, pinyinMap] = await Promise.all([
                window.TransitAPI?.loadStations
                    ? window.TransitAPI.loadStations()
                    : fetch('data/_station.json').then((response) => {
                        if (!response.ok) throw new Error(`station data ${response.status}`);
                        return response.json();
                    }),
                loadTimetableData(),
                window.TransitAPI?.loadStationDetails
                    ? window.TransitAPI.loadStationDetails()
                    : fetch('data/station_details.json').then((response) => response.ok ? response.json() : {}).catch(() => ({})),
                window.TransitAPI?.loadPinyin
                    ? window.TransitAPI.loadPinyin()
                    : fetch('data/station_pinyin.json').then((response) => response.ok ? response.json() : {}).catch(() => ({}))
            ]);
            state.stations = stations;
            state.timetable = timetable;
            state.details = details;
            state.index = window.TransitData.buildLineIndex(state.stations, timetable, { pinyinMap });
            if (refs.count) refs.count.textContent = `${state.index.stations.length} 个站点`;
            state.picker = window.TransitData.createStationPicker(state.index, state.stations, {
                input: refs.search,
                menu: refs.menu,
                lineSelect: refs.line,
                lineSummary: refs.lineSummary,
                openShowsAll: true,
                clearStationOnLineChange: true,
                autoSelectFirstStation: false
            });
            const requestedStation = new URLSearchParams(window.location.search).get('station');
            state.selected = requestedStation && state.stations[requestedStation]
                ? requestedStation
                : null;
            if (state.selected) state.picker.setStation(state.selected);
            refs.line.addEventListener('change', () => {
                state.selected = null;
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
            renderRecentStations();
            renderDetail();
        } catch (error) {
            console.error(error);
            refs.detail.innerHTML = '<section class="result-state is-error"><strong>站点数据加载失败</strong><span>请检查本地服务和 data 目录。</span></section>';
        }
    }

    init();
})();
