(function () {
    const root = typeof window !== 'undefined' ? window : globalThis;
    const cache = new Map();

    async function fetchJson(url, options) {
        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
        return response.json();
    }

    function cached(key, loader) {
        if (!cache.has(key)) {
            cache.set(key, Promise.resolve().then(loader).catch((error) => {
                cache.delete(key);
                throw error;
            }));
        }
        return cache.get(key);
    }

    async function apiWithStaticFallback(apiPath, staticPath) {
        try {
            return await fetchJson(apiPath);
        } catch (apiError) {
            if (!staticPath) throw apiError;
            return fetchJson(staticPath);
        }
    }

    function loadStations() {
        return cached('stations', () => apiWithStaticFallback('/api/stations', 'data/_station.json'));
    }

    function loadPinyin() {
        return cached('pinyin', async () => {
            try {
                return await apiWithStaticFallback('/api/pinyin', 'data/station_pinyin.json');
            } catch (_) {
                return {};
            }
        });
    }

    function loadStationDetails() {
        return cached('station-details', async () => {
            try {
                return await apiWithStaticFallback('/api/station-details', 'data/station_details.json');
            } catch (_) {
                return {};
            }
        });
    }

    function loadTimetablePart(dayType) {
        const weekend = ['weekend', '双休日', '周末'].includes(String(dayType || '').toLowerCase());
        const day = weekend ? 'weekend' : 'workday';
        const staticPath = weekend ? 'data/timetable.weekend.json' : 'data/timetable.workday.json';
        return cached(`timetable:${day}`, () => apiWithStaticFallback(`/api/timetable?day=${day}`, staticPath));
    }

    function loadTimetable() {
        return cached('timetable:all', async () => {
            const parts = await Promise.all([loadTimetablePart('workday'), loadTimetablePart('weekend')]);
            const merged = Object.assign({}, ...parts);
            if (!merged || !Object.keys(merged).length) throw new Error('时刻表分片为空');
            return merged;
        });
    }

    async function loadStation(stationName) {
        const name = String(stationName || '').trim();
        if (!name) return null;
        try {
            return await fetchJson(`/api/stations/${encodeURIComponent(name)}`);
        } catch (_) {
            const stations = await loadStations();
            return stations[name] ? { name, ...stations[name] } : null;
        }
    }

    async function getCapabilities() {
        try {
            return await fetchJson('/api/health');
        } catch (_) {
            return {
                ok: true,
                mode: 'hosted-readonly',
                capabilities: { read: true, write: false },
            };
        }
    }

    async function getNetworkSummary() {
        try {
            return await fetchJson('/api/network');
        } catch (_) {
            const [stations, timetable] = await Promise.all([loadStations(), loadTimetable()]);
            const dayData = timetable['工作日'] || timetable;
            const lineNames = new Set();
            Object.values(stations || {}).forEach((info) => (info.lines || []).forEach((line) => lineNames.add(line)));
            Object.keys(dayData || {}).forEach((line) => lineNames.add(line));
            return {
                stationCount: Object.keys(stations || {}).length,
                lineCount: lineNames.size,
                dayTypes: Object.keys(timetable || {}),
                source: 'static-json',
            };
        }
    }

    function clearCache() {
        cache.clear();
    }

    root.TransitAPI = {
        fetchJson,
        loadStations,
        loadStation,
        loadPinyin,
        loadStationDetails,
        loadTimetablePart,
        loadTimetable,
        getCapabilities,
        getNetworkSummary,
        clearCache,
    };
})();
