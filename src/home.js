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
    };

    const RECENT_ROUTE_KEY = 'subwayRecentRoutes';
    let stations = null;
    let startPicker = null;
    let endPicker = null;
    let routeMode = 'shortestTime';

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
        setMessage('起终点已交换。');
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
            input.addEventListener('stationchange', () => setMessage('站点已选择，可开始规划。', 'ready'));
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
            refs.dataMode.textContent = capabilities.capabilities?.write ? '本地服务 · 可管理数据' : '公共浏览 · 只读数据';
            refs.dataMode.classList.add('is-ready');
            refs.updated.textContent = network.updatedAt
                ? `数据文件更新于 ${new Date(network.updatedAt).toLocaleDateString('zh-CN')}`
                : `已连接 ${index.stations.length} 个站点的本地数据`;
            refs.submit.disabled = false;
            setMessage(`已载入 ${index.stations.length} 个站点，点击输入框可浏览全部站点。`, 'ready');
            wireControls();
        } catch (error) {
            console.error(error);
            refs.dataMode.textContent = '数据连接失败';
            setMessage('无法读取站点或时刻表，请检查本地服务与 data 目录。', 'error');
        }
    }

    init();
})();
