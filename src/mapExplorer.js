(function () {
    const viewport = document.getElementById('mapViewport');
    const transformEl = document.getElementById('viewportTransform');
    const mapHost = document.getElementById('subwayMap');
    const zoomLabel = document.getElementById('zoomLabel');
    const stationCountEl = document.getElementById('hoverStationCount');
    const tooltip = document.getElementById('map-tooltip');
    const stationSearch = document.getElementById('map-station-search');
    const stationMenu = document.getElementById('map-station-menu');
    const stationLine = document.getElementById('map-station-line');
    const stationLineSummary = document.getElementById('map-station-line-summary');
    const stationPanel = document.getElementById('map-station-panel');
    const coveragePanel = document.getElementById('map-coverage-panel');


    let timetableData = null;
    let stationData = null;
    let activeHovered = null;
    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let isDragging = false;
    let lastPointerX = 0;
    let lastPointerY = 0;
    let frameRequested = false;
    let stationPicker = null;
    let svgStationNameSet = new Set();
    const stationLabels = new Map();
    let selectionOutline = null;
    let focusedStation = null;
    const arrivalCache = new Map();

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function scheduleUpdate() {
        if (frameRequested) return;
        frameRequested = true;
        requestAnimationFrame(() => {
            frameRequested = false;
            transformEl.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
            if (zoomLabel) zoomLabel.textContent = `${Math.round(scale * 100)}%`;
        });
    }

    function zoomAt(factor, clientX, clientY) {
        focusedStation = null;
        const rect = viewport.getBoundingClientRect();
        const centerX = clientX - rect.left;
        const centerY = clientY - rect.top;
        const nextScale = clamp(scale * factor, 0.35, 7);
        const scaleRatio = nextScale / scale;
        scale = nextScale;
        translateX = centerX - (centerX - translateX) * scaleRatio;
        translateY = centerY - (centerY - translateY) * scaleRatio;
        scheduleUpdate();
    }

    function resetView() {
        focusedStation = null;
        scale = 1;
        translateX = 0;
        translateY = 0;
        scheduleUpdate();
    }

    function timeStringToMinutes(timeString) {
        const match = String(timeString || '').match(/(\d{1,2}):(\d{2})/);
        if (!match) return NaN;
        const hours = Number(match[1]);
        const minutes = Number(match[2]);
        if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes > 59) return NaN;
        return hours * 60 + minutes;
    }

    function activeDayKey() {
        const day = new Date().getDay();
        return day === 0 || day === 6 ? '双休日' : '工作日';
    }

    function currentMinute() {
        const now = new Date();
        return now.getHours() * 60 + now.getMinutes();
    }


    function nextArrivals(stationName) {
        const dayKey = activeDayKey();
        const minute = currentMinute();
        const cacheKey = `${dayKey}:${minute}:${stationName}`;
        if (arrivalCache.has(cacheKey)) return arrivalCache.get(cacheKey);

        const dayData = timetableData?.[dayKey] || timetableData?.['工作日'] || timetableData?.['双休日'] || timetableData;
        const bestByDirection = new Map();

        for (const lineName of Object.keys(dayData || {})) {
            const lineData = dayData[lineName];
            for (const directionName of Object.keys(lineData || {})) {
                const trains = lineData[directionName];
                for (const trainId of Object.keys(trains || {})) {
                    const schedule = trains[trainId];
                    if (!Array.isArray(schedule)) continue;
                    const stationIndex = schedule.findIndex((stop) => stop[0] === stationName);
                    if (stationIndex === -1) continue;
                    const arrivalMinute = timeStringToMinutes(schedule[stationIndex][1]);
                    if (Number.isNaN(arrivalMinute) || arrivalMinute < minute) continue;
                    const terminal = schedule[schedule.length - 1]?.[0] || directionName;
                    const directionLabel = terminal && terminal !== stationName ? terminal : directionName;
                    const key = `${lineName}:${directionLabel}`;
                    const wait = arrivalMinute - minute;
                    const currentBest = bestByDirection.get(key);
                    if (!currentBest || wait < currentBest.wait) {
                        bestByDirection.set(key, { lineName, directionLabel, wait, trainId });
                    }
                }
            }
        }

        const arrivals = Array.from(bestByDirection.values())
            .sort((first, second) => {
                const lineCompare = first.lineName.localeCompare(second.lineName, 'zh-CN');
                if (lineCompare !== 0) return lineCompare;
                return first.wait - second.wait;
            })
            .slice(0, 10);
        arrivalCache.set(cacheKey, arrivals);
        return arrivals;
    }

    function renderWaitText(arrival) {
        if (arrival.wait <= 0) return `开往${arrival.directionLabel}方向的列车即将进站`;
        if (arrival.wait > 30) return `开往${arrival.directionLabel}方向的下一班列车进站时间大于30分钟`;
        return `开往${arrival.directionLabel}方向的列车还有 ${arrival.wait} 分钟进站`;
    }

    function renderGroupedArrivals(arrivals) {
        const groups = new Map();
        for (const arrival of arrivals) {
            if (!groups.has(arrival.lineName)) groups.set(arrival.lineName, []);
            groups.get(arrival.lineName).push(arrival);
        }
        return Array.from(groups.entries()).map(([lineName, items]) => `
            <div class="arrival-line">
                <strong>${lineName}</strong>
                ${items
                    .sort((first, second) => first.wait - second.wait)
                    .map((arrival) => `<span>${renderWaitText(arrival)}</span>`)
                    .join('')}
            </div>
        `).join('');
    }

    function renderArrivalHtml(stationName, fallbackTitle) {
        const resolvedName = stationData?.[stationName] ? stationName : null;
        if (!resolvedName) {
            return `
                <div class="tooltip-title">${fallbackTitle}</div>
                <div class="arrival-line muted">底图有此站，当前站点总表尚未收录。</div>
            `;
        }

        const arrivals = nextArrivals(resolvedName);
        const lines = stationData[resolvedName]?.lines?.map((lineName) => lineName.replace(/^地铁/, '')).join(' / ') || '站点';
        if (!arrivals.length) {
            return `
                <div class="tooltip-title">${resolvedName}</div>
                <div class="arrival-line"><strong>${lines}</strong><span>当前时段暂无后续班次</span></div>
            `;
        }

        return `
            <div class="tooltip-title">${resolvedName}</div>
            ${renderGroupedArrivals(arrivals)}
        `;
    }

    function showTooltip(clientX, clientY, html) {
        tooltip.innerHTML = html;
        tooltip.classList.add('is-on');
        const bounds = tooltip.getBoundingClientRect();
        tooltip.style.left = `${Math.max(8, Math.min(clientX + 14, window.innerWidth - bounds.width - 12))}px`;
        tooltip.style.top = `${Math.max(8, Math.min(clientY + 14, window.innerHeight - bounds.height - 12))}px`;
    }

    function hideTooltip() {
        tooltip.classList.remove('is-on');
        if (activeHovered) activeHovered.elements.forEach((element) => element.classList.remove('is-hovered'));
        activeHovered = null;
    }

    function cacheStationBox(label) {
        label.boxes = label.elements.map((element) => element.getBBox());
        const left = Math.min(...label.boxes.map((box) => box.x));
        const top = Math.min(...label.boxes.map((box) => box.y));
        const right = Math.max(...label.boxes.map((box) => box.x + box.width));
        const bottom = Math.max(...label.boxes.map((box) => box.y + box.height));
        label.box = { x: left, y: top, width: right - left, height: bottom - top };
    }

    function getSvgPoint(svg, event) {
        const matrix = svg.getScreenCTM();
        if (!matrix) return null;
        const point = svg.createSVGPoint();
        point.x = event.clientX;
        point.y = event.clientY;
        return point.matrixTransform(matrix.inverse());
    }

    function distanceToBox(point, box) {
        const dx = point.x < box.x ? box.x - point.x : point.x > box.x + box.width ? point.x - box.x - box.width : 0;
        const dy = point.y < box.y ? box.y - point.y : point.y > box.y + box.height ? point.y - box.y - box.height : 0;
        return Math.hypot(dx, dy);
    }

    function pickStationGroup(svg, labelGroups, event) {
        const direct = event.target.closest?.('[data-map-station]');
        if (direct && svg.contains(direct)) return stationLabels.get(direct.dataset.mapStation) || null;
        const point = getSvgPoint(svg, event);
        if (!point) return null;
        const matches = labelGroups.filter((label) => label.boxes.some((box) => distanceToBox(point, box) === 0));
        return matches.length === 1 ? matches[0] : null;
    }

    function writeStationRegistryMetadata(svg, stationNames) {
        const namespace = svg.namespaceURI || 'http://www.w3.org/2000/svg';
        const previous = svg.querySelector('#station-json-registry');
        if (previous) previous.remove();
        const metadata = document.createElementNS(namespace, 'metadata');
        metadata.id = 'station-json-registry';
        metadata.textContent = JSON.stringify({
            source: 'data/_station.json',
            total: stationNames.length,
            stations: stationNames,
            locatedLabels: Array.from(svgStationNameSet),
            missingLocations: stationNames.filter((name) => !svgStationNameSet.has(name))
        });
        svg.insertBefore(metadata, svg.firstChild);
        svg.dataset.stationRegistryCount = String(stationNames.length);
    }

    function renderCoveragePanel(index) {
        if (!coveragePanel || !index?.stations) return;
        const total = index.stations.length;
        const mapped = svgStationNameSet.size;
        const missing = index.stations.filter((stationName) => !svgStationNameSet.has(stationName));
        const preview = missing.slice(0, 80);
        coveragePanel.innerHTML = `
            <div class="coverage-metrics">
                <span><strong>${total}</strong> 座可查询车站</span>
                <span><strong>${mapped}</strong> 座图上可选</span>
            </div>
            <details${missing.length ? '' : ' hidden'}>
                <summary>${missing.length} 个条目无原图位置</summary>
                <p>站点总表保留这些名称，但原图没有对应标注，不提供推测位置。</p>
                <div class="map-coverage-chips" aria-label="暂未显示在图上的可查询车站">
                    ${preview.map((stationName) => `<button class="map-coverage-chip" type="button" data-station="${stationName}">${stationName}</button>`).join('')}
                    ${missing.length > preview.length ? `<span class="muted">另有 ${missing.length - preview.length} 个</span>` : ''}
                </div>
            </details>
        `;
    }

    function wireStationHover(svg, mapping) {
        const records = mapping.station_review.filter((entry) => entry.exists_in_source_svg)
            .concat(mapping.source_labels_outside_registry);
        const labelGroups = records.map((entry) => {
            const elements = entry.label_selectors.map((selector) => svg.querySelector(selector));
            if (elements.some((element) => !element)) throw new Error(`地图标签校验失败：${entry.station}`);
            return { station: entry.station, elements };
        });
        svgStationNameSet = new Set();
        stationLabels.clear();
        for (const label of labelGroups) {
            if (label.elements.length > 1) {
                const group = document.createElementNS(svg.namespaceURI, 'g');
                const first = label.elements[0];
                first.parentNode.insertBefore(group, first);
                label.elements.forEach((element) => group.appendChild(element));
                label.elements = [group];
            }
            cacheStationBox(label);
            for (const element of label.elements) {
                element.classList.add('station-hit');
                element.dataset.mapStation = label.station;
                element.setAttribute('aria-label', label.station);
                const title = document.createElementNS(svg.namespaceURI, 'title');
                title.textContent = label.station;
                element.appendChild(title);
            }
            stationLabels.set(label.station, label);
            if (stationData[label.station]) svgStationNameSet.add(label.station);
        }

        svg.addEventListener('pointermove', (event) => {
            if (isDragging) return hideTooltip();
            const group = pickStationGroup(svg, labelGroups, event);
            if (!group) {
                hideTooltip();
                return;
            }
            if (activeHovered && activeHovered !== group) hideTooltip();
            activeHovered = group;
            group.elements.forEach((element) => element.classList.add('is-hovered'));
            showTooltip(event.clientX, event.clientY, renderArrivalHtml(group.station, group.station));
        });

        svg.addEventListener('pointerleave', hideTooltip);
        svg.addEventListener('click', (event) => {
            const group = pickStationGroup(svg, labelGroups, event);
            const resolvedName = group?.station;
            if (stationData[resolvedName] && stationSearch) {
                stationPicker?.setStation(resolvedName);
                renderStationPanel(resolvedName);
            }
        });

        if (stationCountEl) stationCountEl.textContent = String(svgStationNameSet.size || labelGroups.length);
        svg.dataset.mappedStationCount = String(svgStationNameSet.size);
        selectionOutline = document.createElementNS(svg.namespaceURI, 'rect');
        selectionOutline.setAttribute('class', 'map-selected-label');
        selectionOutline.setAttribute('rx', '2');
        selectionOutline.setAttribute('visibility', 'hidden');
        svg.appendChild(selectionOutline);
    }

    function focusStationLabel(stationName) {
        if (focusedStation === stationName) return;
        focusedStation = stationName;
        const label = stationLabels.get(stationName);
        if (!selectionOutline) return;
        selectionOutline.setAttribute('visibility', label ? 'visible' : 'hidden');
        if (!label) return;
        const box = label.box;
        selectionOutline.setAttribute('x', box.x - 2);
        selectionOutline.setAttribute('y', box.y - 2);
        selectionOutline.setAttribute('width', box.width + 4);
        selectionOutline.setAttribute('height', box.height + 4);
        const svg = mapHost.querySelector('svg');
        const matrix = svg.getScreenCTM();
        if (!matrix) return;
        const point = svg.createSVGPoint();
        point.x = box.x + box.width / 2;
        point.y = box.y + box.height / 2;
        const screenPoint = point.matrixTransform(matrix);
        const viewportBox = viewport.getBoundingClientRect();
        const nextScale = Math.max(scale, 5);
        const baseX = (screenPoint.x - viewportBox.left - translateX) / scale;
        const baseY = (screenPoint.y - viewportBox.top - translateY) / scale;
        scale = nextScale;
        translateX = viewport.clientWidth / 2 - baseX * scale;
        translateY = viewport.clientHeight / 2 - baseY * scale;
        scheduleUpdate();
    }

    function renderStationPanel(stationName) {
        if (!stationData?.[stationName]) {
            stationPanel.innerHTML = '未找到该站点，请输入完整中文站名。';
            stationPanel.classList.add('muted');
            return;
        }
        stationPanel.classList.remove('muted');
        focusStationLabel(stationName);
        stationPanel.innerHTML = `
            ${renderArrivalHtml(stationName, stationName)}
            ${svgStationNameSet.has(stationName) ? '' : '<p class="map-location-unavailable">原图没有此站标注，暂不能定位。</p>'}
            <div class="map-station-actions">
                <a class="text-link" href="query.html?start=${encodeURIComponent(stationName)}">设为起点</a>
                <a class="text-link" href="query.html?end=${encodeURIComponent(stationName)}">设为终点</a>
                <a class="text-link" href="station_guide.html?station=${encodeURIComponent(stationName)}">站点导览</a>
            </div>
        `;
    }


    async function loadStationPinyin() {
        if (window.TransitAPI?.loadPinyin) return window.TransitAPI.loadPinyin();
        try {
            const response = await fetch('data/station_pinyin.json');
            if (!response.ok) return {};
            return response.json();
        } catch (_) {
            return {};
        }
    }

    async function loadMap() {
        const [svgText, timetable, stations, mapping, pinyinMap] = await Promise.all([
            fetch('Beijing_Subway_System_Map.svg').then((response) => {
                if (!response.ok) throw new Error('SVG 加载失败');
                return response.text();
            }),
            window.loadTimetableData(),
            window.TransitAPI?.loadStations
                ? window.TransitAPI.loadStations()
                : fetch('data/_station.json').then((response) => {
                    if (!response.ok) throw new Error('站点数据加载失败');
                    return response.json();
                }),
            fetch('data/svg_station_mapping_review.json').then((response) => {
                if (!response.ok) throw new Error('地图标注索引加载失败');
                return response.json();
            }),
            loadStationPinyin()
        ]);

        const sourceHash = await window.SourceIntegrity.sha256(svgText);
        if (sourceHash !== mapping.source_svg.sha256) throw new Error('地图版本与标注索引不一致，请重新核验映射');
        timetableData = timetable;
        stationData = stations;
        mapHost.innerHTML = svgText;

        const svg = mapHost.querySelector('svg');
        if (!svg) throw new Error('SVG 内容格式异常');
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        wireStationHover(svg, mapping);

        const index = window.TransitData.buildLineIndex(stationData, timetableData, { pinyinMap });
        writeStationRegistryMetadata(svg, index.stations);
        renderCoveragePanel(index);
        stationPicker = window.TransitData.createStationPicker(index, stationData, {
            input: stationSearch,
            menu: stationMenu,
            lineSelect: stationLine,
            lineSummary: stationLineSummary,
            openShowsAll: true,
            clearStationOnLineChange: true,
            autoSelectFirstStation: false
        });
        const params = new URLSearchParams(window.location.search);
        const requestedStation = params.get('station');
        if (requestedStation && stationData[requestedStation]) {
            stationPicker.setStation(requestedStation);
            renderStationPanel(requestedStation);
        } else {
            stationPanel.innerHTML = '<div class="map-panel-empty"><strong>查找站点</strong><span>搜索中文站名、线路号或拼音首字母；也可直接悬浮图面站点。</span></div>';
        }
    }

    function zoomAtCenter(factor) {
        const rect = viewport.getBoundingClientRect();
        zoomAt(factor, rect.left + rect.width / 2, rect.top + rect.height / 2);
    }

    document.getElementById('zoomInBtn').addEventListener('click', () => zoomAtCenter(1.15));
    document.getElementById('zoomOutBtn').addEventListener('click', () => zoomAtCenter(1 / 1.15));
    document.getElementById('resetBtn').addEventListener('click', resetView);

    viewport.addEventListener('wheel', (event) => {
        event.preventDefault();
        focusedStation = null;
        if (event.ctrlKey || event.metaKey) {
            zoomAt(event.deltaY < 0 ? 1.12 : 1 / 1.12, event.clientX, event.clientY);
            return;
        }
        translateX -= event.deltaX;
        translateY -= event.deltaY;
        scheduleUpdate();
    }, { passive: false });

    viewport.addEventListener('dblclick', (event) => zoomAt(1.25, event.clientX, event.clientY));

    viewport.addEventListener('pointerdown', (event) => {
        if (!event.shiftKey && event.pointerType !== 'touch') return;
        isDragging = true;
        focusedStation = null;
        lastPointerX = event.clientX;
        lastPointerY = event.clientY;
        transformEl.classList.add('dragging');
        viewport.setPointerCapture(event.pointerId);
    });

    viewport.addEventListener('pointermove', (event) => {
        if (!isDragging) return;
        translateX += event.clientX - lastPointerX;
        translateY += event.clientY - lastPointerY;
        lastPointerX = event.clientX;
        lastPointerY = event.clientY;
        scheduleUpdate();
    });

    function endDrag() {
        isDragging = false;
        transformEl.classList.remove('dragging');
    }

    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);
    viewport.addEventListener('pointerleave', endDrag);

    window.addEventListener('keydown', (event) => {
        if (event.target.matches?.('input, textarea, select, [contenteditable="true"]')) return;
        if (event.key === '+' || event.key === '=') zoomAtCenter(1.12);
        if (event.key === '-' || event.key === '_') zoomAtCenter(1 / 1.12);
        if (event.key === '0') resetView();
    });

    stationSearch.addEventListener('change', () => renderStationPanel(stationPicker?.resolve() || stationSearch.value.trim()));
    stationSearch.addEventListener('stationchange', (event) => renderStationPanel(event.detail.station));
    stationSearch.addEventListener('input', () => {
        const value = stationSearch.value.trim();
        if (stationData?.[value]) renderStationPanel(value);
    });
    coveragePanel?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-station]');
        const stationName = button?.dataset.station;
        if (!stationName || !stationData?.[stationName]) return;
        stationPicker?.setStation(stationName);
        renderStationPanel(stationName);
    });

    loadMap().catch((error) => {
        console.error(error);
        mapHost.innerHTML = '<div class="route-path-card">地铁图或时刻表未加载，请检查 SVG 与 data/timetable.*.json。</div>';
        stationPanel.textContent = '数据加载失败';
        if (window.showToast) window.showToast('地图数据加载失败');
    });

    scheduleUpdate();
})();
