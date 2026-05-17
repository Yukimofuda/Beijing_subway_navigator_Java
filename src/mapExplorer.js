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

    let stationAliases = {
        Sihui_East: '四惠东',
        Sihui: '四惠',
        Dawanglu: '大望路',
        Guomao: '国贸',
        Yong_anli: '永安里',
        Muxidi: '木樨地',
        Military_Museum: '军事博物馆',
        Gongzhufen: '公主坟',
        Wanshoulu: '万寿路',
        Wukesong: '五棵松',
        Yuquanlu: '玉泉路',
        Babaoshan: '八宝山',
        BAP: '八角游乐园',
        Gucheng: '古城',
        Pingguoyuan: '苹果园',
        Fuxingmen: '复兴门',
        Xidan: '西单',
        Tian_anmen_West: '天安门西',
        Tian_anmen_East: '天安门东',
        Wangfujing: '王府井',
        Dongdan: '东单',
        Jianguomen: '建国门',
        Changchunjie: '长椿街',
        Xuanwumen: '宣武门',
        Hepingmen: '和平门',
        Qianmen: '前门',
        Chongwenmen: '崇文门',
        BRS: '北京站',
        Chaoyangmen: '朝阳门',
        Dongsishitiao: '东四十条',
        Dongzhimen: '东直门',
        Andingmen: '安定门',
        Guloudajie: '鼓楼大街',
        Jishuitan: '积水潭',
        Fuchengmen: '阜成门',
        Xizhimen: '西直门',
        Lucheng: '潞城',
        Dongxiayuan: '东夏园',
        Haojiafu: '郝家府',
        Beiyunhe_East: '北运河东',
        Beiyunhe_West: '北运河西',
        Tongzhou_Beiguan: '通州北关',
        Wuzixueyuanlu: '物资学院路',
        Caofang: '草房',
        Changying: '常营',
        Huangqu: '黄渠',
        Dalianpo: '褡裢坡',
        Qingnianlu: '青年路',
        Shilipu: '十里堡',
        Jintailu: '金台路',
        Hujialou: '呼家楼',
        Dongdaqiao: '东大桥',
        Huayuanqiao: '花园桥',
        Cishousi: '慈寿寺',
        Tiancun: '田村',
        Nanluoguxiang: '南锣鼓巷',
        National_Art_Museum: '中国美术馆',
        Gongyixiqiao: '公益西桥',
        Jiaomen_West: '角门西',
        Majiapu: '马家堡',
        BSRS: '北京南站',
        Taoranting: '陶然亭',
        Caishikou: '菜市口',
        Beijing_Zoo: '动物园',
        National_Library: '国家图书馆',
        Weigongcun: '魏公村',
        Renmin_University: '人民大学',
        Haidianhuangzhuang: '海淀黄庄',
        Zhongguancun: '中关村',
        EGPU: '北京大学东门',
        Yuanmingyuan_Park: '圆明园',
        Xiyuan: '西苑',
        Beigongmen: '北宫门',
        Anheqiao_North: '安河桥北',
        Tiangongyuan: '天宫院',
        Biomedical_Base: '生物医药基地',
        Yihezhuang: '义和庄',
        HRS: '黄村火车站',
        Huangcunxidajie: '黄村西大街',
        Qingyuanlu: '清源路',
        Zaoyuan: '枣园',
        Gaomidian_South: '高米店南',
        Gaomidian_North: '高米店北',
        Xihongmen: '西红门',
        Xingong: '新宫',
        Lingjing_Hutong: '灵境胡同',
        Xinjiekou: '新街口',
        Xisi: '西四',
        Songjiazhuang: '宋家庄',
        Liujiayao: '刘家窑',
        Puhuangyu: '蒲黄榆',
        Tiantan_Dongmen: '天坛东门',
        Ciqikou: '磁器口',
        Hepingli_Beijie: '和平里北街',
        Beixinqiao: '北新桥',
        Zhangzizhonglu: '张自忠路',
        Dongsi: '东四',
        Dengshikou: '灯市口',
        Jinanqiao: '金安桥',
        Jin_anqiao: '金安桥',
        Mudanyuan: '牡丹园',
        Caoqiao: '草桥'
    };

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
        scale = 1;
        translateX = 0;
        translateY = 0;
        scheduleUpdate();
    }

    function timeStringToMinutes(timeString) {
        if (!/^\d{2}:\d{2}$/.test(String(timeString || ''))) return NaN;
        const [hours, minutes] = timeString.split(':').map(Number);
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

    function cleanSvgId(id) {
        return String(id || '')
            .replace(/^en_/, '')
            .replace(/-\d+$/, '');
    }

    function displaySvgName(rawName) {
        return rawName.replace(/_/g, ' ');
    }

    function resolveStationName(rawName) {
        const cleanName = cleanSvgId(rawName);
        return stationAliases[cleanName] || null;
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
                <div class="arrival-line muted">该 SVG 标注未能匹配到中文时刻表站名，可在左侧输入中文站点查询。</div>
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
        tooltip.style.left = `${Math.min(clientX + 14, window.innerWidth - 360)}px`;
        tooltip.style.top = `${Math.min(clientY + 14, window.innerHeight - 220)}px`;
        tooltip.classList.add('is-on');
    }

    function hideTooltip() {
        tooltip.classList.remove('is-on');
        if (activeHovered) activeHovered.classList.remove('is-hovered');
        activeHovered = null;
    }

    function cacheStationBox(group) {
        try {
            const box = group.getBBox();
            if (!box.width || !box.height) return;
            group.__stationBox = box;
            group.__stationCenter = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        } catch (_) {
            // Some SVG groups may not expose a box until fully painted.
        }
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
        const point = getSvgPoint(svg, event);
        if (!point) return null;
        const tolerance = clamp(18 / scale, 2.5, 26);
        let best = null;

        for (const group of labelGroups) {
            const box = group.__stationBox;
            if (!box) continue;
            const distance = distanceToBox(point, box);
            if (distance > tolerance) continue;
            const center = group.__stationCenter;
            const centerDistance = center ? Math.hypot(point.x - center.x, point.y - center.y) : distance;
            const score = distance * 1000 + centerDistance + box.width * box.height * 0.0001;
            if (!best || score < best.score) best = { group, score };
        }

        return best?.group || null;
    }

    function wireStationHover(svg) {
        const labelGroups = Array.from(svg.querySelectorAll('[id^="en_"]'));
        for (const group of labelGroups) {
            group.classList.add('station-hit');
            cacheStationBox(group);
            group.__rawStationName = cleanSvgId(group.id);
            group.__resolvedStationName = resolveStationName(group.id);
            group.__fallbackTitle = displaySvgName(group.__rawStationName);
        }

        svg.addEventListener('pointermove', (event) => {
            const group = pickStationGroup(svg, labelGroups, event);
            if (!group) {
                hideTooltip();
                return;
            }
            if (activeHovered && activeHovered !== group) activeHovered.classList.remove('is-hovered');
            activeHovered = group;
            group.classList.add('is-hovered');
            showTooltip(event.clientX, event.clientY, renderArrivalHtml(group.__resolvedStationName, group.__fallbackTitle));
        });

        svg.addEventListener('pointerleave', hideTooltip);
        svg.addEventListener('click', (event) => {
            const group = pickStationGroup(svg, labelGroups, event) || activeHovered;
            const resolvedName = group?.__resolvedStationName;
            if (resolvedName && stationSearch) {
                stationSearch.value = resolvedName;
                renderStationPanel(resolvedName);
            }
        });

        if (stationCountEl) stationCountEl.textContent = String(labelGroups.length);
    }

    function renderStationPanel(stationName) {
        if (!stationData?.[stationName]) {
            stationPanel.innerHTML = '未找到该站点，请输入完整中文站名。';
            stationPanel.classList.add('muted');
            return;
        }
        stationPanel.classList.remove('muted');
        stationPanel.innerHTML = renderArrivalHtml(stationName, stationName);
    }

    async function loadAliasOverrides() {
        try {
            const response = await fetch('data/svg_station_aliases.json');
            if (!response.ok) return {};
            return response.json();
        } catch (_) {
            return {};
        }
    }

    async function loadMap() {
        const [svgText, timetable, stations, aliasOverrides] = await Promise.all([
            fetch('Beijing_Subway_System_Map.svg').then((response) => {
                if (!response.ok) throw new Error('SVG 加载失败');
                return response.text();
            }),
            window.loadTimetableData(),
            fetch('data/_station.json').then((response) => {
                if (!response.ok) throw new Error('站点数据加载失败');
                return response.json();
            }),
            loadAliasOverrides()
        ]);

        stationAliases = { ...stationAliases, ...aliasOverrides };
        timetableData = timetable;
        stationData = stations;
        mapHost.innerHTML = svgText;

        const svg = mapHost.querySelector('svg');
        if (!svg) throw new Error('SVG 内容格式异常');
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        wireStationHover(svg);

        const index = window.TransitData.buildLineIndex(stationData, timetableData);
        stationPicker = window.TransitData.createStationPicker(index, stationData, {
            input: stationSearch,
            menu: stationMenu,
            lineSelect: stationLine,
            lineSummary: stationLineSummary
        });
        const stationNames = index.lines[0]?.stations.length ? index.lines[0].stations : index.stations;
        const params = new URLSearchParams(window.location.search);
        const requestedStation = params.get('station');
        if (requestedStation && stationData[requestedStation]) {
            stationPicker.setStation(requestedStation);
            renderStationPanel(requestedStation);
        } else {
            renderStationPanel(stationNames[0]);
        }
    }

    document.getElementById('zoomInBtn').addEventListener('click', () => zoomAt(1.15, viewport.clientWidth / 2, viewport.clientHeight / 2));
    document.getElementById('zoomOutBtn').addEventListener('click', () => zoomAt(1 / 1.15, viewport.clientWidth / 2, viewport.clientHeight / 2));
    document.getElementById('resetBtn').addEventListener('click', resetView);

    viewport.addEventListener('wheel', (event) => {
        event.preventDefault();
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
        if (!event.shiftKey) return;
        isDragging = true;
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
        if (event.key === '+' || event.key === '=') zoomAt(1.12, viewport.clientWidth / 2, viewport.clientHeight / 2);
        if (event.key === '-' || event.key === '_') zoomAt(1 / 1.12, viewport.clientWidth / 2, viewport.clientHeight / 2);
        if (event.key === '0') resetView();
    });

    stationSearch.addEventListener('change', () => renderStationPanel(stationPicker?.resolve() || stationSearch.value.trim()));
    stationSearch.addEventListener('stationchange', (event) => renderStationPanel(event.detail.station));
    stationSearch.addEventListener('input', () => {
        const value = stationSearch.value.trim();
        if (stationData?.[value]) renderStationPanel(value);
    });

    loadMap().catch((error) => {
        console.error(error);
        mapHost.innerHTML = '<div class="route-path-card">地铁图或时刻表未加载，请检查 SVG 与 data/timetable.*.json。</div>';
        stationPanel.textContent = '数据加载失败';
        if (window.showToast) window.showToast('地图数据加载失败');
    });

    scheduleUpdate();
})();
