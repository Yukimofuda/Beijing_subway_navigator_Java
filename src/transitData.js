(function () {
    const LINE_COLORS = {
        '1号线': '#A4343A',
        '八通线': '#A4343A',
        '1号线八通线': '#A4343A',
        '2号线': '#006098',
        '4号线大兴线': '#008C95',
        '4号线': '#008C95',
        '5号线': '#A6217C',
        '6号线': '#D09700',
        '7号线': '#F6C500',
        '8号线': '#009B77',
        '9号线': '#8FC31F',
        '10号线': '#009BC0',
        '11号线': '#ED796B',
        '12号线': '#A7A9AC',
        '13号线': '#F9E700',
        '14号线': '#D5A4C3',
        '15号线': '#653279',
        '16号线': '#76A32E',
        '17号线': '#00A3E0',
        '19号线': '#D6A2B8',
        '昌平线': '#DE85B1',
        '房山线': '#F49AC1',
        '燕房线': '#D85F90',
        '亦庄线': '#D6006E',
        '首都机场线': '#A192B2',
        '大兴机场线': '#004B87',
        'S1线': '#B35C1E',
        '西郊线': '#E4002B'
    };

    function simplifyLineName(lineName) {
        return String(lineName || '')
            .replace(/^地铁/, '')
            .replace(/\(.+\)$/, '')
            .replace(/(内环|外环)$/, '')
            .trim();
    }

    function lineRank(lineName) {
        const numeric = simplifyLineName(lineName).match(/^(\d+)号线/);
        if (numeric) return [0, Number(numeric[1]), ''];
        if (lineName === 'S1线') return [1, 1, ''];
        return [2, 999, lineName];
    }

    function compareLines(first, second) {
        const a = lineRank(first);
        const b = lineRank(second);
        if (a[0] !== b[0]) return a[0] - b[0];
        if (a[1] !== b[1]) return a[1] - b[1];
        return a[2].localeCompare(b[2], 'zh-CN');
    }

    function orderedUnique(items) {
        return Array.from(new Set(items.filter(Boolean)));
    }

    function normalizeKeyword(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '');
    }

    function normalizeLineQuery(value) {
        const query = normalizeKeyword(value);
        if (/^\d+$/.test(query)) return `${query}号线`;
        if (/^s\d+$/i.test(query)) return `${query.toUpperCase()}线`;
        return query;
    }

    function lineColor(lineName) {
        return LINE_COLORS[simplifyLineName(lineName)] || '#3c4043';
    }

    function getStationSearchTokens(stationName, pinyinMap = {}) {
        const detail = pinyinMap?.[stationName] || {};
        return orderedUnique([
            stationName,
            normalizeKeyword(stationName),
            normalizeKeyword(detail.pinyin),
            normalizeKeyword(detail.initials)
        ]);
    }

    function getLineSearchTokens(line) {
        const label = simplifyLineName(line?.label || line);
        const fullNames = Array.isArray(line?.fullNames) ? line.fullNames : [];
        const number = label.match(/\d+/)?.[0] || '';
        return orderedUnique([
            label,
            normalizeKeyword(label),
            number,
            number ? `${number}号线` : '',
            ...fullNames,
            ...fullNames.map(normalizeKeyword)
        ].filter(Boolean));
    }

    function lineSegmentsForStation(index, stationName) {
        const segments = [];
        for (const line of index.lines || []) {
            const stationIndex = line.stations.indexOf(stationName);
            if (stationIndex === -1) continue;
            segments.push({
                line: line.label,
                color: line.color,
                previous: stationIndex > 0 ? line.stations[stationIndex - 1] : null,
                current: stationName,
                next: stationIndex < line.stations.length - 1 ? line.stations[stationIndex + 1] : null,
                index: stationIndex + 1,
                total: line.stations.length
            });
        }
        return segments.sort((a, b) => compareLines(a.line, b.line));
    }

    function getDayData(timetable) {
        return timetable?.['工作日'] || timetable?.['双休日'] || timetable?.['周末'] || timetable || {};
    }

    function extractBestStationOrderFromTimetable(lineData) {
        let best = [];
        for (const direction of Object.keys(lineData || {})) {
            const trains = lineData[direction] || {};
            for (const trainNo of Object.keys(trains)) {
                const schedule = trains[trainNo];
                if (!Array.isArray(schedule)) continue;
                const order = orderedUnique(schedule.map((stop) => stop?.[0]).filter(Boolean));
                if (order.length > best.length) best = order;
            }
        }
        return best;
    }

    function orderStationsForLine(stationSet, timetableOrder, stationOrderIndex = new Map()) {
        const seen = new Set();
        const ordered = [];

        for (const stationName of timetableOrder || []) {
            if (stationSet.has(stationName) && !seen.has(stationName)) {
                ordered.push(stationName);
                seen.add(stationName);
            }
        }

        const rest = Array.from(stationSet)
            .filter((stationName) => !seen.has(stationName))
            .sort((a, b) => {
                const aOrder = stationOrderIndex.has(a) ? stationOrderIndex.get(a) : Number.POSITIVE_INFINITY;
                const bOrder = stationOrderIndex.has(b) ? stationOrderIndex.get(b) : Number.POSITIVE_INFINITY;
                if (aOrder !== bOrder) return aOrder - bOrder;
                return a.localeCompare(b, 'zh-CN');
            });

        return [...ordered, ...rest];
    }

    function buildStationSearchIndex(stations, options = {}) {
        const pinyinMap = options.pinyinMap || {};
        return Object.keys(stations || {}).reduce((index, stationName) => {
            index.set(stationName, getStationSearchTokens(stationName, pinyinMap));
            return index;
        }, new Map());
    }

    function buildLineIndex(stations, timetable, options = {}) {
        const dayData = getDayData(timetable);
        const stationNames = Object.keys(stations || {});
        const stationSet = new Set(stationNames);
        const stationOrderIndex = new Map(stationNames.map((stationName, index) => [stationName, index]));
        const lineBuckets = new Map();
        const pinyinMap = options.pinyinMap || {};

        function ensureLine(rawLineName) {
            const label = simplifyLineName(rawLineName);
            if (!lineBuckets.has(label)) {
                lineBuckets.set(label, {
                    label,
                    fullNames: new Set(),
                    stations: new Set(),
                    orderedFromTimetable: []
                });
            }
            const bucket = lineBuckets.get(label);
            bucket.fullNames.add(rawLineName);
            return bucket;
        }

        for (const stationName of stationNames) {
            for (const rawLine of stations[stationName].lines || []) {
                ensureLine(rawLine).stations.add(stationName);
            }
        }

        for (const rawLineName of Object.keys(dayData || {})) {
            const bucket = ensureLine(rawLineName);
            const bestOrder = extractBestStationOrderFromTimetable(dayData[rawLineName]);
            for (const stationName of bestOrder) {
                if (stationSet.has(stationName)) bucket.stations.add(stationName);
            }
            const filteredOrder = bestOrder.filter((stationName) => stationSet.has(stationName));
            if (filteredOrder.length > bucket.orderedFromTimetable.length) {
                bucket.orderedFromTimetable = filteredOrder;
            }
        }

        const lines = Array.from(lineBuckets.values())
            .map((bucket) => {
                const orderedStations = orderStationsForLine(bucket.stations, bucket.orderedFromTimetable, stationOrderIndex);
                return {
                    label: bucket.label,
                    fullNames: Array.from(bucket.fullNames),
                    stations: orderedStations,
                    stationSet: new Set(orderedStations),
                    orderMap: new Map(orderedStations.map((stationName, index) => [stationName, index])),
                    color: lineColor(bucket.label)
                };
            })
            .sort((a, b) => compareLines(a.label, b.label));
        const lineMap = new Map(lines.map((line) => [line.label, line]));
        const rawLineMap = new Map();
        for (const line of lines) {
            for (const rawLineName of line.fullNames) rawLineMap.set(rawLineName, line);
        }

        return {
            stations: stationNames.sort((a, b) => a.localeCompare(b, 'zh-CN')),
            stationSet,
            stationMap: stations || {},
            lines,
            lineMap,
            rawLineMap,
            pinyinMap,
            stationSearchIndex: buildStationSearchIndex(stations, { pinyinMap })
        };
    }

    function getOrCreateLineIndex(stations, timetable, options = {}) {
        if (options.index?.lineMap && options.index?.stations) return options.index;
        return buildLineIndex(stations, timetable, options);
    }

    function allLineCandidates(index) {
        const realLines = index?.lines || [];
        const realLabels = new Set(realLines.map((line) => line.label));
        const virtualLines = Object.keys(LINE_COLORS)
            .filter((label) => !realLabels.has(label))
            .map((label) => ({ label, fullNames: [label], stations: [], color: lineColor(label), virtual: true }));
        return [...realLines, ...virtualLines];
    }

    function matchLineCandidates(index, keyword, options = {}) {
        const query = normalizeKeyword(keyword);
        const lineQuery = normalizeLineQuery(keyword);
        if (!query) return [];

        return allLineCandidates(index)
            .map((line) => {
                const tokens = getLineSearchTokens(line);
                let score = 0;
                if (tokens.includes(query) || tokens.includes(lineQuery)) score = 100;
                else if (tokens.some((token) => token.startsWith(query) || token.startsWith(lineQuery))) score = 80;
                else if (tokens.some((token) => token.includes(query) || token.includes(lineQuery))) score = 60;
                return { line, score };
            })
            .filter((item) => item.score > 0)
            .sort((a, b) => b.score - a.score || compareLines(a.line.label, b.line.label))
            .slice(0, options.limit || 8)
            .map((item) => item.line);
    }

    function matchStationCandidates(index, stations, keyword, options = {}) {
        const query = normalizeKeyword(keyword);
        const rawKeyword = String(keyword || '').trim();
        const lineFilter = simplifyLineName(options.lineFilter || '');
        const pinyinMap = options.pinyinMap || index?.pinyinMap || {};
        const stationSearchIndex = index?.stationSearchIndex || buildStationSearchIndex(stations, { pinyinMap });
        const pool = lineFilter
            ? index?.lineMap?.get(lineFilter)?.stations || []
            : index?.stations || Object.keys(stations || {}).sort((a, b) => a.localeCompare(b, 'zh-CN'));

        if (!query) return pool.slice(0, options.limit || 20);

        return pool
            .map((stationName) => {
                const tokens = stationSearchIndex.get(stationName) || getStationSearchTokens(stationName, pinyinMap);
                let score = 0;
                if (stationName === rawKeyword) score = 100;
                else if (stationName.startsWith(rawKeyword)) score = 90;
                else if (stationName.includes(rawKeyword)) score = 75;
                else if (tokens.some((token) => token === query)) score = 85;
                else if (tokens.some((token) => token.startsWith(query))) score = 70;
                else if (tokens.some((token) => token.includes(query))) score = 50;
                return { stationName, score };
            })
            .filter((item) => item.score > 0)
            .sort((a, b) => b.score - a.score || a.stationName.localeCompare(b.stationName, 'zh-CN'))
            .slice(0, options.limit || 20)
            .map((item) => item.stationName);
    }

    function resolveStationName(index, stations, inputValue, options = {}) {
        const value = String(inputValue || '').trim();
        if (stations?.[value]) return value;

        const matches = matchStationCandidates(index, stations, value, {
            ...options,
            limit: 2
        });

        return matches.length === 1 ? matches[0] : '';
    }

    function stationLines(stations, stationName) {
        return Array.from(new Set((stations?.[stationName]?.lines || []).map(simplifyLineName))).sort(compareLines);
    }

    function fillLineSelect(index, select) {
        if (!select) return;
        const current = select.value;
        select.innerHTML = ['<option value="">全部线路</option>', ...index.lines.map((line) => `<option value="${line.label}">${line.label}</option>`)].join('');
        if (current && index.lineMap.has(current)) select.value = current;
    }

    function createStationPicker(index, stations, config) {
        const input = config.input;
        const menu = config.menu;
        const lineSelect = config.lineSelect;
        const lineSummary = config.lineSummary;
        if (!input || !menu || !lineSelect) return null;
        const openShowsAll = config.openShowsAll !== false;
        const clearStationOnLineChange = config.clearStationOnLineChange !== false;
        const resolveFuzzy = config.resolveFuzzy !== false;

        fillLineSelect(index, lineSelect);

        function selectedLine() {
            return lineSelect.hidden ? '' : lineSelect.value;
        }

        function setLineMode(mode, value) {
            if (!lineSummary) return;
            if (mode === 'summary') {
                lineSelect.hidden = true;
                lineSummary.hidden = false;
                lineSummary.value = value;
                return;
            }
            lineSummary.hidden = true;
            lineSelect.hidden = false;
        }

        function applyStation(stationName) {
            input.value = stationName;
            input.dataset.station = stationName;
            const lines = stationLines(stations, stationName);
            if (lines.length === 1) {
                setLineMode('select');
                lineSelect.value = lines[0];
            } else if (lines.length > 1) {
                setLineMode('summary', lines.join(' / '));
            }
        }

        function showLineStations(lineLabel) {
            setLineMode('select');
            lineSelect.value = lineLabel;
            if (clearStationOnLineChange) {
                input.value = '';
                delete input.dataset.station;
            }
            const line = index.lineMap.get(lineLabel);
            const stationsOnLine = line?.stations || [];
            menu.innerHTML = stationsOnLine.length
                ? stationsOnLine.map((stationName) => {
                    const lines = stationLines(stations, stationName);
                    return `
                    <button class="combo-option" type="button" data-kind="station" data-value="${stationName}" data-station="${stationName}">
                        <span class="combo-kind">${lines.join(' / ') || '站点'}</span>${stationName}
                    </button>
                `;
                }).join('')
                : '<div class="combo-option muted">该线路暂无站点数据</div>';
            menu.classList.add('is-open');
        }

        function renderMenu(options = {}) {
            const showAll = Boolean(options.showAll);
            const keyword = showAll ? '' : String(options.keyword ?? input.value).trim();
            const line = options.forceLine || selectedLine();
            const lineCandidates = !line && keyword
                ? matchLineCandidates(index, keyword, { limit: options.lineLimit || 8 })
                : [];
            const stationCandidates = matchStationCandidates(index, stations, keyword, {
                lineFilter: line,
                pinyinMap: index.pinyinMap || {},
                limit: showAll ? Infinity : (options.limit || 40)
            });
            const items = [];

            for (const candidate of lineCandidates) {
                items.push(`
                    <button class="combo-option" type="button" data-kind="line" data-value="${candidate.label}">
                        <span class="combo-kind">线路</span>${candidate.label}
                    </button>
                `);
            }

            for (const stationName of stationCandidates) {
                const lines = stationLines(stations, stationName);
                items.push(`
                    <button class="combo-option" type="button" data-kind="station" data-value="${stationName}" data-station="${stationName}">
                        <span class="combo-kind">${lines.join(' / ') || '站点'}</span>${stationName}
                    </button>
                `);
            }

            menu.innerHTML = items.join('') || '<div class="combo-option muted">没有匹配站点</div>';
            menu.classList.add('is-open');
        }

        function openFullMenu() {
            renderMenu({
                keyword: '',
                mode: 'open',
                showAll: openShowsAll
            });
        }

        function searchMenu() {
            renderMenu({
                keyword: input.value.trim(),
                mode: 'search',
                showAll: false
            });
        }

        input.addEventListener('focus', openFullMenu);
        input.addEventListener('click', openFullMenu);
        input.addEventListener('input', () => {
            delete input.dataset.station;
            setLineMode('select');
            searchMenu();
        });
        lineSelect.addEventListener('change', () => {
            if (clearStationOnLineChange) {
                input.value = '';
                delete input.dataset.station;
            }
            renderMenu({
                keyword: '',
                mode: 'open',
                showAll: true,
                forceLine: selectedLine()
            });
        });
        menu.addEventListener('click', (event) => {
            const option = event.target.closest('.combo-option');
            if (!option) return;
            if (option.dataset.kind === 'line') {
                showLineStations(option.dataset.value);
                return;
            }
            const stationName = option.dataset.station || option.dataset.value;
            if (!stationName) return;
            applyStation(stationName);
            menu.classList.remove('is-open');
            input.dispatchEvent(new CustomEvent('stationchange', { detail: { station: stationName } }));
        });
        document.addEventListener('click', (event) => {
            if (input.contains(event.target) || menu.contains(event.target)) return;
            menu.classList.remove('is-open');
        });
        return {
            resolve() {
                let stationName = input.dataset.station || '';
                if (!stationName && stations[input.value.trim()]) stationName = input.value.trim();
                if (!stationName && resolveFuzzy) {
                    stationName = resolveStationName(index, stations, input.value, {
                        pinyinMap: index.pinyinMap || {},
                        lineFilter: selectedLine()
                    });
                }
                return stations[stationName] ? stationName : '';
            },
            setStation: applyStation,
            renderMenu,
            openFullMenu
        };
    }

    window.TransitData = {
        LINE_COLORS,
        simplifyLineName,
        compareLines,
        lineColor,
        buildLineIndex,
        getOrCreateLineIndex,
        buildStationSearchIndex,
        normalizeKeyword,
        getStationSearchTokens,
        getLineSearchTokens,
        matchStationCandidates,
        matchLineCandidates,
        resolveStationName,
        stationLines,
        lineSegmentsForStation,
        createStationPicker,
        getDayData
    };
})();
