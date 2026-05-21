# Station Data Audit

## query.js 数据读取

- `src/query.js` 页面启动时通过 `Promise.all()` 同时调用 `loadTimetableData()`、`fetch('data/_station.json')`、`fetch('data/station_pinyin.json')`。
- `timetableData` 先保存完整时刻表对象，随后调用 `normalizeTimetableData(timetable)` 取 `工作日` 数据作为路线图构建输入。
- `stationData` 直接来自 `data/_station.json`，是查询页选择器应使用的站点全集。
- `buildStationPickerIndex(stations)` 当前只是 wrapper，调用 `window.TransitData.buildLineIndex(stations, timetableData, { pinyinMap })`。
- `buildGraph(timetableData)` 只从工作日时刻表构建 `subwayGraph`，用于路线计算；因此某站如果存在于 `_station.json` 但不在 timetable 中，选择器仍应显示，但查询时可能因图中缺少节点而提示无路径。

## query.js 候选站点来源

- 当前候选站点通过 `TransitData.buildLineIndex()` 生成。
- 正确目标：`index.stations` 必须等于 `Object.keys(data/_station.json)`，时刻表只用于补充线路顺序和线路方向，不允许削减站点全集。
- 当前旧实现会先把 timetable 的首个 schedule 写入线路站点，再把 `_station.json` 中站点追加进去；站点全集来自 `_station.json`，但每条线内顺序可能被首班车/首个方向影响，且部分展示逻辑有 slice 限制。

## station_guide.html / stationGuide.js 数据读取

- `station_guide.html` 加载 `src/timetableLoader.js`、`src/transitData.js`、`src/stationGuide.js`。
- `src/stationGuide.js` 在 `init()` 中读取 `data/_station.json`、`loadTimetableData()`、`data/station_details.json`、`data/station_pinyin.json`。
- 当前使用 `window.TransitData.buildLineIndex(state.stations, timetable, { pinyinMap })` 和 `window.TransitData.createStationPicker()`。
- `renderList()` 使用 `currentStationList()`，如果选了线路则读 `state.index.lineMap.get(line).stations`，否则读 `state.index.stations`。
- 漏站风险来自 `TransitData.buildLineIndex()` 对线路内 station 列表的构造、`createStationPicker()` 中候选数量 slice、以及选择线路后菜单只显示部分站点；页面不应因为某站没有 timetable/edge/details 而从候选中删除。

## fare_calculator.html / fareCalculator.js 数据读取

- `src/fareCalculator.js` 在 `init()` 中读取 `data/_station.json`、`loadTimetableData()`、`data/station_pinyin.json`。
- 起点和终点选择器均使用 `TransitData.buildLineIndex()` 和 `TransitData.createStationPicker()`。
- 票价计算路径使用 `_station.json` 的 `edge` 距离数据；即使某站边数据不完整，选择器也不应隐藏该站，计算时再显示“未找到可用路径”。
- `fare_calculator.html` 当前按钮 DOM 前有一个多余 `</div>`，导致“测算/交换”按钮脱离表单卡片正常流，是按钮偏移的直接风险。

## Map.html / mapExplorer.js 数据读取

- `Map.html` 加载 `src/timetableLoader.js`、`src/transitData.js`、`src/mapExplorer.js`。
- `src/mapExplorer.js` 读取 SVG、`loadTimetableData()`、`data/_station.json`、`data/svg_station_aliases.json`、`data/station_pinyin.json`。
- 地图站点搜索使用 `TransitData.buildLineIndex(stationData, timetableData, { pinyinMap })` 和 `TransitData.createStationPicker()`。
- SVG 悬浮、下一班车信息使用 timetable 和 SVG alias，不应影响选择器的站点全集。

## TransitData.buildLineIndex 当前输出

- `index.stations`：当前是 `Object.keys(stations).sort(localeCompare)`，应包含 `_station.json` 全量站点。
- `index.lines`：由 timetable 线路和 `_station.json` 的 `station.lines` 合并生成。
- `index.lineMap`：`Map<label, line>`，每条 `line.stations` 当前混合 timetable 首个 schedule 顺序与 `_station.json` 追加站点。
- 当前缺少 `stationSet`、`stationMap`、`rawLineMap`，不便审计页面是否漏站。
- 当前线路内额外站点可能按 `_station.json` 对象出现顺序追加，不保证运行顺序；`showLineStations()` 和 `matchStationCandidates()` 又有 slice 限制，可能造成视觉漏站。

## createStationPicker 当前行为

- `focus` 直接调用 `renderMenu()`，而 `renderMenu()` 使用 `input.value.trim()` 作为 keyword；所以输入框已有“西直门”时，重新打开只显示“西直门”相关候选。
- `input` 事件会删除 `input.dataset.station`，如果输入值刚好是站名会调用 `applyStation()`，然后按当前关键词渲染菜单。
- 点击线路候选进入 `showLineStations(lineLabel)`，该函数设置 `lineSelect.value` 并显示该线站点，但当前使用 `slice(0, 36)`，长线路会漏站。
- `lineSelect change` 会清空 input 和 dataset，并调用 `renderMenu()` 后立刻关闭菜单；用户看不到该线路全部站点。
- 选择 station 后 `applyStation()` 写入 `input.value` 和 `input.dataset.station`，并按站点所属线路设置线路选择框或摘要。
- 当前“打开选项框看不到全部站点”的直接原因是 focus/open 使用已有 input value 过滤，而不是空 keyword。

## 漏站可能原因

- `_station.json` 有站，但 timetable 没有：选择器仍必须显示，路线/时刻表功能再提示缺数据。
- timetable 有站，但 `_station.json` 没有：不应进入站点全集，审计脚本应列出用于补数据判断。
- `simplifyLineName()` 如果错误处理特殊线路，会导致线路桶合并/查找错误；当前对 `S1线`、`昌平线`、`房山线`、`首都机场线`、`大兴机场线`保留正常。
- `showLineStations().slice(0, 36)`、旧要求中的 `slice(0, 28)` 都会造成线路内长列表漏站。
- `matchStationCandidates()` 默认 limit 20/28，如果 open 模式也用这个 limit，会导致“打开全部站点”时漏站。
- stationGuide 如果只读 `lineMap.get(line).stations`，而 line.stations 构造不完整，就会漏站。
- 线路内排序如果对站点中文排序，会打乱真实运行顺序；应优先取 timetable 中最长 schedule 顺序，剩余站点追加不丢。
