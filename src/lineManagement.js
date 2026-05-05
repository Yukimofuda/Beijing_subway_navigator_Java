document.addEventListener('DOMContentLoaded', () => {
    const resultDiv = document.getElementById('result');
    const queryButton = document.getElementById('query-button');
    if (!resultDiv || !queryButton) return;

    const controlGrid = queryButton.parentElement;
    if (!controlGrid) return;

    const manageButton = document.createElement('button');
    manageButton.type = 'button';
    manageButton.className = 'btn btn-ghost';
    manageButton.textContent = '增删线路';
    manageButton.addEventListener('click', openLineManagementPanel);
    controlGrid.appendChild(manageButton);

    let stationGraph = null;

    async function ensureStationGraphLoaded() {
        if (stationGraph) return stationGraph;
        const response = await fetch('data/_station.json');
        if (!response.ok) throw new Error(`加载站点数据失败: HTTP ${response.status}`);
        stationGraph = await response.json();
        return stationGraph;
    }

    function toTimeString(totalMinutes) {
        const h = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
        const m = String(totalMinutes % 60).padStart(2, '0');
        return `${h}:${m}`;
    }

    function createStationsInputs(containerId, count, className, placeholderPrefix) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        for (let index = 0; index < count; index += 1) {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = `input ${className}`;
            input.placeholder = `${placeholderPrefix}${index + 1}`;
            container.appendChild(input);
        }
    }

    function openLineManagementPanel() {
        resultDiv.innerHTML = `
            <div class="card" style="margin-top:10px;">
                <div class="card-body" style="padding-top:16px;">
                    <h3 class="title" style="font-size:20px;">线路管理</h3>
                    <p class="subtitle">新增或删除线路上的站点信息</p>

                    <div class="grid" style="margin-top:14px;">
                        <button type="button" id="lm-tab-add" class="btn btn-primary btn-toggle is-selected">新增线路</button>
                        <button type="button" id="lm-tab-delete" class="btn btn-ghost btn-toggle">删除站点</button>
                    </div>

                    <div id="lm-add-panel" style="margin-top:14px;">
                        <div class="field">
                            <div class="label">线路名称</div>
                            <input class="input" type="text" id="lm-line-name" placeholder="例如：测试线(起点--终点)">
                        </div>
                        <div class="grid" style="margin-top:10px;">
                            <div class="field">
                                <div class="label">站点数量</div>
                                <input class="input" type="number" id="lm-station-count" min="2" value="2">
                            </div>
                            <div class="field">
                                <div class="label">最高速度 (km/h)</div>
                                <input class="input" type="number" id="lm-max-speed" min="1" value="75">
                            </div>
                        </div>
                        <div id="lm-add-stations" class="list" style="margin-top:10px;"></div>
                        <div style="margin-top:12px;">
                            <button type="button" id="lm-add-submit" class="btn btn-primary">保存新增</button>
                        </div>
                    </div>

                    <div id="lm-delete-panel" style="margin-top:14px; display:none;">
                        <div class="field">
                            <div class="label">线路名称</div>
                            <input class="input" type="text" id="lm-delete-line-name" placeholder="请输入线路名称">
                        </div>
                        <div class="field" style="margin-top:10px;">
                            <div class="label">删除站点数量</div>
                            <input class="input" type="number" id="lm-delete-station-count" min="1" value="1">
                        </div>
                        <div id="lm-delete-stations" class="list" style="margin-top:10px;"></div>
                        <div style="margin-top:12px;">
                            <button type="button" id="lm-delete-submit" class="btn btn-primary">保存删除</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const addTab = document.getElementById('lm-tab-add');
        const deleteTab = document.getElementById('lm-tab-delete');
        const addPanel = document.getElementById('lm-add-panel');
        const deletePanel = document.getElementById('lm-delete-panel');
        const stationCountInput = document.getElementById('lm-station-count');
        const deleteCountInput = document.getElementById('lm-delete-station-count');

        addTab.addEventListener('click', () => {
            addTab.classList.add('is-selected');
            deleteTab.classList.remove('is-selected');
            addPanel.style.display = '';
            deletePanel.style.display = 'none';
        });

        deleteTab.addEventListener('click', () => {
            deleteTab.classList.add('is-selected');
            addTab.classList.remove('is-selected');
            addPanel.style.display = 'none';
            deletePanel.style.display = '';
        });

        stationCountInput.addEventListener('input', () => {
            const count = Math.max(2, parseInt(stationCountInput.value, 10) || 2);
            createStationsInputs('lm-add-stations', count, 'lm-add-station', '站点 ');
        });
        deleteCountInput.addEventListener('input', () => {
            const count = Math.max(1, parseInt(deleteCountInput.value, 10) || 1);
            createStationsInputs('lm-delete-stations', count, 'lm-delete-station', '删除站点 ');
        });

        createStationsInputs('lm-add-stations', 2, 'lm-add-station', '站点 ');
        createStationsInputs('lm-delete-stations', 1, 'lm-delete-station', '删除站点 ');

        const addSubmit = document.getElementById('lm-add-submit');
        const deleteSubmit = document.getElementById('lm-delete-submit');

        addSubmit.addEventListener('click', addLine);
        deleteSubmit.addEventListener('click', deleteStations);
    }

    async function addLine() {
        try {
            const lineName = document.getElementById('lm-line-name').value.trim();
            const stationCount = Math.max(2, parseInt(document.getElementById('lm-station-count').value, 10) || 2);
            const speed = parseFloat(document.getElementById('lm-max-speed').value);
            const stationInputs = Array.from(document.querySelectorAll('.lm-add-station'));
            const stations = stationInputs.map((input) => input.value.trim()).filter(Boolean);

            if (!lineName || stations.length !== stationCount || Number.isNaN(speed) || speed <= 0) {
                if (window.showToast) window.showToast('请完整填写新增线路信息');
                return;
            }

            const graph = await ensureStationGraphLoaded();
            const distance = 2000;
            const travelSeconds = distance / (speed / 3.6);

            for (let index = 0; index < stations.length - 1; index += 1) {
                const from = stations[index];
                const to = stations[index + 1];

                if (!graph[from]) graph[from] = { edge: [], lines: [], line_siz: 0 };
                if (!graph[to]) graph[to] = { edge: [], lines: [], line_siz: 0 };

                graph[from].edge.push({ station: to, line: lineName, distance, speed, time: travelSeconds });
                graph[to].edge.push({ station: from, line: lineName, distance, speed, time: travelSeconds });

                if (!graph[from].lines.includes(lineName)) {
                    graph[from].lines.push(lineName);
                    graph[from].line_siz += 1;
                }
                if (!graph[to].lines.includes(lineName)) {
                    graph[to].lines.push(lineName);
                    graph[to].line_siz += 1;
                }
            }

            const startMinutes = 6 * 60;
            const departure = {};
            stations.forEach((stationName, index) => {
                const stationMinutes = startMinutes + Math.round((travelSeconds * index) / 60);
                departure[stationName] = toTimeString(stationMinutes);
            });

            const scheduleArray = stations.map((stationName, index) => {
                const stationMinutes = startMinutes + Math.round((travelSeconds * index) / 60);
                return [stationName, toTimeString(stationMinutes)];
            });

            const directionName = `${stations[0]}-${stations[stations.length - 1]}`;
            const timetablePatch = {
                [lineName]: {
                    [directionName]: {
                        train1: scheduleArray,
                    },
                },
            };

            await Promise.all([
                fetch('/saveStationData', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(graph),
                }),
                fetch('/saveTimetableData', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(timetablePatch),
                }),
            ]);

            if (window.showToast) window.showToast('新增线路已保存');
        } catch (error) {
            console.error(error);
            if (window.showToast) window.showToast('新增线路失败');
        }
    }

    async function deleteStations() {
        try {
            const lineName = document.getElementById('lm-delete-line-name').value.trim();
            const count = Math.max(1, parseInt(document.getElementById('lm-delete-station-count').value, 10) || 1);
            const inputs = Array.from(document.querySelectorAll('.lm-delete-station'));
            const toDelete = inputs.map((input) => input.value.trim()).filter(Boolean);

            if (!lineName || toDelete.length !== count) {
                if (window.showToast) window.showToast('请完整填写删除信息');
                return;
            }

            const graph = await ensureStationGraphLoaded();
            const toDeleteSet = new Set(toDelete);

            for (const stationName of Object.keys(graph)) {
                const node = graph[stationName];
                node.edge = (node.edge || []).filter((edge) => {
                    if (edge.line !== lineName) return true;
                    if (toDeleteSet.has(stationName)) return false;
                    return !toDeleteSet.has(edge.station);
                });
                const hasLineEdge = node.edge.some((edge) => edge.line === lineName);
                node.lines = (node.lines || []).filter((line) => line !== lineName || hasLineEdge);
                node.line_siz = node.lines.length;
            }

            for (const stationName of toDelete) {
                if (graph[stationName] && graph[stationName].line_siz === 0) {
                    delete graph[stationName];
                }
            }

            await Promise.all([
                fetch('/saveStationData', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(graph),
                }),
                fetch('/deleteTimetableStations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ lineName, stations: toDelete }),
                }),
            ]);

            if (window.showToast) window.showToast('删除站点已保存');
        } catch (error) {
            console.error(error);
            if (window.showToast) window.showToast('删除站点失败');
        }
    }
});
