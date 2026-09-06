(function () {
    const refs = {
        start: document.getElementById('home-start'),
        startMenu: document.getElementById('home-start-menu'),
        startLine: document.getElementById('home-start-line'),
        startLineSummary: document.getElementById('home-start-line-summary'),
        end: document.getElementById('home-end'),
        endMenu: document.getElementById('home-end-menu'),
        endLine: document.getElementById('home-end-line'),
        endLineSummary: document.getElementById('home-end-line-summary'),
        submit: document.getElementById('home-submit'),
        swap: document.getElementById('home-swap'),
        message: document.getElementById('home-form-message'),
        currentTime: document.getElementById('home-current-time'),
        dayType: document.getElementById('home-day-type'),
        stationCount: document.getElementById('home-station-count'),
        lineCount: document.getElementById('home-line-count'),
        dataMode: document.getElementById('home-data-mode'),
        updated: document.getElementById('home-updated'),
        recent: document.getElementById('home-recent-routes'),
        liveTitle: document.getElementById('home-live-title'),
        liveClock: document.getElementById('home-live-clock'),
        departures: document.getElementById('home-live-departures'),
    };

    const RECENT_ROUTE_KEY = 'subwayRecentRoutes';
    let stations = null;
    let timetableData = null;
    let startPicker = null;
    let endPicker = null;
    let routeMode = 'shortestTime';

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function timeToMinutes(value) {
        const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
        if (!match) return NaN;
        return Number(match[1]) * 60 + Number(match[2]);
    }

    function currentMinute() {
        const now = new Date();
        return now.getHours() * 60 + now.getMinutes();
    }

    function findNextDepartures(stationName, limit = 4) {
        if (!stationName || !timetableData) return [];
        const dayData = window.TransitData.getDayData(timetableData) || {};
        const nowMinute = currentMinute();
        const departures = [];
        const seen = new Set();

        Object.entries(dayData).forEach(([line, lineData]) => {
            Object.entries(lineData || {}).forEach(([direction, trains]) => {
                Object.entries(trains || {}).forEach(([trainNo, schedule]) => {
                    if (!Array.isArray(schedule)) return;
                    const stopIndex = schedule.findIndex((stop) => stop?.[0] === stationName);
                    if (stopIndex < 0 || stopIndex >= schedule.length - 1) return;
                    const time = schedule[stopIndex]?.[1];
                    const minute = timeToMinutes(time);
                    if (!Number.isFinite(minute) || minute < nowMinute) return;
                    const key = `${line}|${direction}|${time}`;
                    if (seen.has(key)) return;
                    seen.add(key);
                    departures.push({
                        line,
                        direction,
                        trainNo,
                        time,
                        minute,
                        waitMinutes: minute - nowMinute,
                        terminal: schedule[schedule.length - 1]?.[0] || direction,
                    });
                });
            });
        });

        return departures
            .sort((first, second) => first.minute - second.minute || first.line.localeCompare(second.line, 'zh-CN', { numeric: true }))
            .slice(0, limit);
    }

    function waitLabel(minutes) {
        if (minutes <= 0) return '即将进站';
        if (minutes === 1) return '约 1 分钟';
        return `约 ${minutes} 分钟`;
    }

    function renderNextDepartures(stationName) {
        if (!refs.departures || !refs.liveTitle) return;
        if (!stationName) {
            refs.liveTitle.textContent = '选择出发站';
            refs.liveClock.textContent = '当前时刻';
            refs.departures.innerHTML = '<div class="home-departure-empty">选择出发站后显示近期列车。</div>';
            return;
        }

        const departures = findNextDepartures(stationName);
        refs.liveTitle.textContent = `${stationName} · 下一班`;
        refs.liveClock.textContent = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
        if (!departures.length) {
            refs.departures.innerHTML = '<div class="home-departure-empty">当前时段暂无后续列车，可查看今日运营确认首末班。</div>';
            return;
        }

        refs.departures.innerHTML = departures.map((departure) => {
            const color = window.TransitData.lineColor(departure.line);
            return `
                <a class="home-departure-row" href="service_board.html" style="--departure-color:${color}">
                    <span class="home-departure-line">${escapeHtml(window.TransitData.simplifyLineName(departure.line))}</span>
                    <span class="home-departure-destination">开往 ${escapeHtml(departure.terminal)}</span>
                    <span class="home-departure-wait"><strong>${escapeHtml(waitLabel(departure.waitMinutes))}</strong><small>${escapeHtml(departure.time)}</small></span>
                </a>
            `;
        }).join('');
    }

    function updatePlannerReadiness() {
        const { start, end } = resolveEndpoints();
        renderNextDepartures(start);
        if (start && end) {
            setMessage(`${start} → ${end} 已就绪，选择偏好后开始规划。`, 'ready');
        } else if (start) {
            setMessage(`已选择 ${start}，继续选择目的站。`, 'ready');
        } else if (end) {
            setMessage(`已选择 ${end}，继续选择出发站。`, 'ready');
        }
    }

    function setMessage(message, type = '') {
        refs.message.textContent = message;
        refs.message.className = `form-message${type ? ` is-${type}` : ''}`;
    }

    function updateClock() {
        const now = new Date();
        refs.currentTime.textContent = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
        const weekend = now.getDay() === 0 || now.getDay() === 6;
        refs.dayType.textContent = `${now.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short' })} · ${weekend ? '双休日时刻' : '工作日时刻'}`;
    }

    function readRecentRoutes() {
        try {
            const value = JSON.parse(localStorage.getItem(RECENT_ROUTE_KEY) || '[]');
            return Array.isArray(value) ? value.filter((item) => item?.start && item?.end).slice(0, 4) : [];
        } catch (_) {
            return [];
        }
    }

    function renderRecentRoutes() {
        const routes = readRecentRoutes();
        if (!routes.length) return;
        refs.recent.innerHTML = routes.map((route) => {
            const params = new URLSearchParams({
                start: route.start,
                end: route.end,
                mode: route.mode || 'shortestTime',
                auto: '1',
            });
            return `
                <a class="recent-route" href="query.html?${params.toString()}">
                    <span><strong>${route.start}</strong><i aria-hidden="true">→</i><strong>${route.end}</strong></span>
                    <small>${route.mode === 'leastTransfers' ? '少换乘' : '时间优先'}${route.time ? ` · ${route.time}` : ''}</small>
                </a>
            `;
        }).join('');
    }

    function resolveEndpoints() {
        return {
            start: startPicker?.resolve?.() || '',
            end: endPicker?.resolve?.() || '',
        };
    }

    function submitRoute() {
        const { start, end } = resolveEndpoints();
        if (!start || !end) {
            setMessage('请从候选列表中选择出发站和目的站。', 'error');
            return;
        }
        if (start === end) {
            setMessage('出发站与目的站不能相同。', 'error');
            return;
        }
        const params = new URLSearchParams({ start, end, mode: routeMode, auto: '1' });
        window.location.href = `query.html?${params.toString()}`;
    }

    function swapEndpoints() {
        const start = startPicker?.resolve?.();
        const end = endPicker?.resolve?.();
        if (end) startPicker.setStation(end);
        else {
            refs.start.value = refs.end.value;
            delete refs.start.dataset.station;
        }
        if (start) endPicker.setStation(start);
        else {
            refs.end.value = '';
            delete refs.end.dataset.station;
        }
        updatePlannerReadiness();
    }

    function wireControls() {
        document.querySelectorAll('[data-home-mode]').forEach((button) => {
            button.addEventListener('click', () => {
                routeMode = button.dataset.homeMode;
                document.querySelectorAll('[data-home-mode]').forEach((item) => {
                    item.classList.toggle('is-selected', item === button);
                });
            });
        });
        refs.submit.addEventListener('click', submitRoute);
        refs.swap.addEventListener('click', swapEndpoints);
        [refs.start, refs.end].forEach((input) => {
            input.addEventListener('stationchange', updatePlannerReadiness);
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' && input.getAttribute('aria-expanded') !== 'true') {
                    submitRoute();
                }
            });
        });
    }

    async function init() {
        updateClock();
        setInterval(updateClock, 30000);
        renderRecentRoutes();

        try {
            const [stationData, timetable, pinyinMap, capabilities, network] = await Promise.all([
                window.TransitAPI.loadStations(),
                window.loadTimetableData(),
                window.TransitAPI.loadPinyin(),
                window.TransitAPI.getCapabilities(),
                window.TransitAPI.getNetworkSummary(),
            ]);
            stations = stationData;
            timetableData = timetable;
            const index = window.TransitData.buildLineIndex(stations, timetable, { pinyinMap });
            startPicker = window.TransitData.createStationPicker(index, stations, {
                input: refs.start,
                menu: refs.startMenu,
                lineSelect: refs.startLine,
                lineSummary: refs.startLineSummary,
                openShowsAll: true,
                clearStationOnLineChange: true,
                autoSelectFirstStation: false,
                resolveFuzzy: false,
            });
            endPicker = window.TransitData.createStationPicker(index, stations, {
                input: refs.end,
                menu: refs.endMenu,
                lineSelect: refs.endLine,
                lineSummary: refs.endLineSummary,
                openShowsAll: true,
                clearStationOnLineChange: true,
                autoSelectFirstStation: false,
                resolveFuzzy: false,
            });

            refs.stationCount.textContent = String(network.stationCount || index.stations.length);
            refs.lineCount.textContent = String(network.lineCount || index.lines.length);
            refs.dataMode.textContent = capabilities.capabilities?.write ? '服务可用' : '可在线浏览';
            refs.dataMode.classList.add('is-ready');
            refs.updated.textContent = network.updatedAt
                ? `时刻表更新于 ${new Date(network.updatedAt).toLocaleDateString('zh-CN')}`
                : `${index.stations.length} 座车站可查询`;
            refs.submit.disabled = false;
            setMessage(`${index.stations.length} 座车站已就绪`, 'ready');
            wireControls();
        } catch (error) {
            console.error(error);
            refs.dataMode.textContent = '暂时不可用';
            setMessage('行程信息暂时无法载入，请稍后刷新。', 'error');
        }
    }

    init();
})();
