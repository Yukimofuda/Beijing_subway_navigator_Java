document.addEventListener('DOMContentLoaded', () => {
    const lineButtonsDiv = document.getElementById('line-buttons');
    if (!lineButtonsDiv) return;

    function simplifyLineName(lineName) {
        return String(lineName || '')
            .replace(/^地铁/, '')
            .replace(/\(.+\)$/, '')
            .replace(/(内环|外环)$/, '')
            .trim();
    }

    function createButton(text, className) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = className;
        button.textContent = text;
        return button;
    }

    function renderLineButtons(lineGroups, timetable) {
        lineButtonsDiv.innerHTML = '';
        lineButtonsDiv.className = 'line-choice-grid';

        const sortedLines = Array.from(lineGroups.keys()).sort((a, b) => window.TransitData ? window.TransitData.compareLines(a, b) : a.localeCompare(b, 'zh-CN'));
        for (const lineName of sortedLines) {
            const button = createButton(lineName, 'line-button line-choice-button');
            button.addEventListener('click', () => renderDirectionButtons(lineName, lineGroups.get(lineName), timetable));
            lineButtonsDiv.appendChild(button);
        }

        if (!sortedLines.length) {
            lineButtonsDiv.innerHTML = '<div class="muted">未找到线路数据</div>';
        }
    }

    function getTimetableLine(lineName, timetable) {
        const dayData = timetable?.['工作日'] || timetable?.['双休日'] || timetable || {};
        return Object.keys(dayData).find((candidate) => simplifyLineName(candidate) === lineName);
    }

    function renderDirectionButtons(lineName, variants, timetable) {
        lineButtonsDiv.innerHTML = '';
        lineButtonsDiv.className = 'direction-choice-panel';

        const head = document.createElement('div');
        head.className = 'route-path-card';
        head.innerHTML = `<div class="pill">已选择线路</div><h2 style="margin:10px 0 0;">${lineName}</h2><p class="subtitle">请选择方向后查看站点顺序与区间信息。</p>`;
        lineButtonsDiv.appendChild(head);

        const grid = document.createElement('div');
        grid.className = 'line-choice-grid';
        const timetableLineName = getTimetableLine(lineName, timetable);
        const lineData = timetableLineName ? (timetable['工作日'] || timetable['双休日'] || timetable)[timetableLineName] : null;
        const directions = lineData ? Object.keys(lineData) : Array.from(variants);

        directions.forEach((direction) => {
            const trains = lineData?.[direction] || {};
            const firstTrain = trains[Object.keys(trains)[0]];
            const firstStation = Array.isArray(firstTrain) ? firstTrain[0]?.[0] : '';
            const lastStation = Array.isArray(firstTrain) ? firstTrain[firstTrain.length - 1]?.[0] : '';
            const isRing = lineName === '2号线' || lineName === '10号线';
            const directionLabel = firstStation && lastStation
                ? `${isRing ? (/内|顺/.test(direction) ? '顺时针' : '逆时针') : ''}${firstStation}到${lastStation}`
                : direction;
            const button = createButton(directionLabel, 'line-button line-choice-button');
            button.addEventListener('click', () => {
                localStorage.setItem('currentLine', lineName);
                localStorage.setItem('currentLineDirection', direction);
                localStorage.setItem('currentLineTimetableName', timetableLineName || '');
                window.location.href = 'line_details.html';
            });
            grid.appendChild(button);
        });

        const back = createButton('返回线路列表', 'btn btn-ghost');
        back.addEventListener('click', () => renderLineButtons(window.__lineGroups, timetable));
        lineButtonsDiv.appendChild(grid);
        lineButtonsDiv.appendChild(back);
    }

    Promise.all([
        fetch('data/_station.json').then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        }),
        window.loadTimetableData ? window.loadTimetableData() : Promise.resolve({}),
    ])
        .then(([stationData, timetable]) => {
            const lineGroups = new Map();
            for (const stationName of Object.keys(stationData || {})) {
                const lines = stationData[stationName].lines || [];
                lines.forEach((line) => {
                    const canonical = simplifyLineName(line);
                    if (!lineGroups.has(canonical)) lineGroups.set(canonical, new Set());
                    lineGroups.get(canonical).add(line);
                });
            }
            window.__lineGroups = lineGroups;
            renderLineButtons(lineGroups, timetable);
        })
        .catch((error) => {
            console.error('加载站点数据失败:', error);
            lineButtonsDiv.innerHTML = '<div class="muted">站点数据加载失败</div>';
            if (window.showToast) window.showToast('站点数据加载失败');
        });
});
