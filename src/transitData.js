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

    function lineColor(lineName) {
        return LINE_COLORS[simplifyLineName(lineName)] || '#3c4043';
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

    function firstScheduleForLine(lineData) {
        for (const direction of Object.keys(lineData || {})) {
            const trains = lineData[direction] || {};
            for (const trainNo of Object.keys(trains)) {
                if (Array.isArray(trains[trainNo]) && trains[trainNo].length) return trains[trainNo];
            }
        }
        return [];
    }

    function buildLineIndex(stations, timetable) {
        const dayData = getDayData(timetable);
        const lineMap = new Map();

        for (const lineName of Object.keys(dayData || {})) {
            const label = simplifyLineName(lineName);
            const scheduleStations = firstScheduleForLine(dayData[lineName]).map((stop) => stop[0]);
            if (!lineMap.has(label)) lineMap.set(label, { label, fullNames: new Set(), stations: [] });
            const item = lineMap.get(label);
            item.fullNames.add(lineName);
            item.stations = orderedUnique([...item.stations, ...scheduleStations]);
        }

        for (const stationName of Object.keys(stations || {})) {
            for (const rawLine of stations[stationName].lines || []) {
                const label = simplifyLineName(rawLine);
                if (!lineMap.has(label)) lineMap.set(label, { label, fullNames: new Set(), stations: [] });
                const item = lineMap.get(label);
                item.fullNames.add(rawLine);
                if (!item.stations.includes(stationName)) item.stations.push(stationName);
            }
        }

        const lines = Array.from(lineMap.values())
            .map((line) => ({
                label: line.label,
                fullNames: Array.from(line.fullNames),
                stations: line.stations.filter((stationName) => stations?.[stationName]),
                color: lineColor(line.label)
            }))
            .sort((a, b) => compareLines(a.label, b.label));

        return {
            stations: Object.keys(stations || {}).sort((a, b) => a.localeCompare(b, 'zh-CN')),
            lines,
            lineMap: new Map(lines.map((line) => [line.label, line]))
        };
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

        function stationPool() {
            const line = selectedLine();
            return line ? index.lineMap.get(line)?.stations || [] : index.stations;
        }

        function renderMenu() {
            const keyword = input.value.trim();
            const line = selectedLine();
            let candidates = stationPool().filter((stationName) => !keyword || stationName.includes(keyword));
            if (!line && keyword) {
                const matchedLine = index.lines.find((item) => item.label.includes(keyword));
                if (matchedLine) candidates = matchedLine.stations;
            }
            menu.innerHTML = candidates.slice(0, 36).map((stationName) => {
                const lines = stationLines(stations, stationName);
                return `
                    <button class="combo-option" type="button" data-station="${stationName}">
                        <span class="combo-kind">${lines.join(' / ') || '站点'}</span>${stationName}
                    </button>
                `;
            }).join('') || '<div class="combo-option muted">没有匹配站点</div>';
            menu.classList.add('is-open');
        }

        input.addEventListener('focus', renderMenu);
        input.addEventListener('input', () => {
            delete input.dataset.station;
            setLineMode('select');
            if (stations[input.value.trim()]) applyStation(input.value.trim());
            renderMenu();
        });
        lineSelect.addEventListener('change', () => {
            input.value = '';
            delete input.dataset.station;
            renderMenu();
            menu.classList.remove('is-open');
        });
        menu.addEventListener('click', (event) => {
            const option = event.target.closest('[data-station]');
            if (!option) return;
            applyStation(option.dataset.station);
            menu.classList.remove('is-open');
            input.dispatchEvent(new CustomEvent('stationchange', { detail: { station: option.dataset.station } }));
        });
        document.addEventListener('click', (event) => {
            if (input.contains(event.target) || menu.contains(event.target)) return;
            menu.classList.remove('is-open');
        });
        return {
            resolve() {
                const stationName = input.dataset.station || input.value.trim();
                return stations[stationName] ? stationName : '';
            },
            setStation: applyStation
        };
    }

    window.TransitData = {
        LINE_COLORS,
        simplifyLineName,
        compareLines,
        lineColor,
        buildLineIndex,
        stationLines,
        lineSegmentsForStation,
        createStationPicker,
        getDayData
    };
})();
