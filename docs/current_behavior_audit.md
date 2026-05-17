# Current Behavior Audit

本文件记录当前原生 HTML/CSS/JS 项目的既有行为，后续改造必须以“不破坏这些行为”为前提。

## 1. `src/query.js` 当前职责

- 页面级状态：维护 `travelRequirement`、`timetableData`、`stationData`、`currentTimeInMinutes`、`subwayGraph`、`transferWeights`、`isDataReady`、`stationPickerIndex`。
- 数据加载：通过 `loadTimetableData()` 加载 `data/timetable.workday.json` 与 `data/timetable.weekend.json`，通过 `fetch('data/_station.json')` 加载站点数据。
- 站点选择器：当前包含一套 fallback 选择器实现，包括 `buildStationPickerIndex()`、`setupStationPickers()`、`resolvePickerStation()`，在 `window.TransitData` 存在时优先调用 `TransitData.buildLineIndex()` 与 `TransitData.createStationPicker()`。
- 路线图构建：`buildGraph()` 从工作日时刻表构建 `subwayGraph`。
- 路线算法：`dijkstraShortestPath()` 计算“最短时间”，`dijkstraLeastTransfers()` 计算“最少换乘”。
- 实际出行估算：`calculateActualTime()` 与 `findNextDeparture()` 按当前时间从时刻表中找下一班车；找不到时会 fallback 成 2 分钟估算。
- 票价估算：`calculateFare()` 基于 `_station.json` 中相邻站 `distance` 累加后按北京地铁阶梯票价估算。
- 结果渲染：`getRoute()` 调用算法、实际时间估算、票价估算，并写入 `#result.innerHTML`。

## 2. `query.js` 当前如何构建 `subwayGraph`

- 数据加载完成后先调用 `normalizeTimetableData(timetable)`，当前优先返回 `timetable['工作日']`。
- `buildGraph(timetableData)` 遍历线路、方向、车次与相邻站点。
- 邻接表结构：
  - `adjacencyList[station] = [{ station, line, travelTime, direction }]`
  - `edgeWeights[key] = travelTime`
  - `lineOfConnection[key] = line`
- `travelTime` 来自相邻站到站时间差，异常时默认 2 分钟。
- 2号线 `西直门` ↔ `积水潭` 特殊固定 3 分钟。
- 当前 `buildGraph()` 还会添加同站虚拟换乘边：同一站不同线路之间添加 `station -> station`，`travelTime = 5`。

## 3. `query.js` 当前如何计算“最短时间”

- `dijkstraShortestPath(startStation, endStation)` 使用 `subwayGraph.adjacencyList`。
- 距离状态以站点为单位：`distances[station]`。
- 队列元素包含 `station`、`time`、`prevLine`、`prevDirection`、`transfers`。
- 遍历邻接边时，如果上一条线路或方向不同，会额外加 5 分钟并增加换乘次数。
- 返回对象包含：
  - `path`
  - `totalTime`
  - `lines`
  - `directions`
  - `transfers`

## 4. `query.js` 当前如何计算“最少换乘”

- `dijkstraLeastTransfers(startStation, endStation)` 同样使用 `subwayGraph.adjacencyList`。
- 队列优先按 `lineChangeCount`，再按 `time` 排序。
- 换乘判断只比较 `prevLine !== connectingLine`。
- 返回对象包含：
  - `path`
  - `totalTime`
  - `lines`
  - `directions`
  - `transfers`

## 5. `query.js` 当前如何渲染查询结果

- `getRoute()` 根据 `travelRequirement` 调用 `dijkstraShortestPath()` 或 `dijkstraLeastTransfers()`。
- 然后调用 `calculateActualTime(start, end, routeResult.path, currentTimeInMinutes)` 计算展示用预计出发/到达时间。
- 渲染结构写入 `#result.innerHTML`：
  - 第一张 `.route-path-card`：包含 `.pill`，文字为 `${travelRequirement}乘车方案`。
  - `.route-summary`：包含四个 `.route-summary-card`，展示预计出发、预计到达、总时间、费用/换乘。
  - “线路与站点”卡片：调用 `buildRouteLineDiagram(segments)`。
  - “完整路径”卡片：展示 `path.join(' → ')`。
  - “每站到站时间”卡片：`.station-time-list`。
- 当前“总时间”使用 `endTime - currentTimeInMinutes`，这是展示用实际等车估算；它不应反写覆盖 `routeResult.totalTime` 静态路径耗时。

## 6. 线路颜色横线展示沿途站点的 DOM 与 CSS

- 渲染函数：`buildRouteLineDiagram(segments)`。
- 颜色来源：`lineColor(lineName)`，内部优先调用 `window.TransitData.lineColor(lineName)`。
- DOM 结构：
  - `.route-line-visual`
  - `.route-line-block`，内联样式 `style="--line-color:${lineColor(block.line)};"`
  - `.route-line-label`
  - `.route-line-track`
  - `.route-station-strip`
  - `.route-station`
  - `.route-station.is-terminal`
- CSS 位于 `style/styles.css`：
  - `.route-line-block` 使用 `border-left: 8px solid var(--line-color)`。
  - `.route-line-label::before` 和 `.route-line-track` 使用 `background: var(--line-color)`。
  - `.route-station-strip` 横向排列沿途站点。
- 不能删除或替换成纯文本列表。

## 7. `src/transitData.js` 当前公共函数

当前导出：

- `LINE_COLORS`
- `simplifyLineName()`
- `compareLines()`
- `lineColor()`
- `buildLineIndex()`
- `stationLines()`
- `lineSegmentsForStation()`
- `createStationPicker()`
- `getDayData()`

当前 `createStationPicker()` 支持线路选择、站点输入、候选菜单、`stationchange` 事件，但匹配能力主要是中文站名 `includes()` 和简单线路 label 包含。

## 8. 其他页面是否使用 `TransitData.createStationPicker`

- `src/mapExplorer.js`：已使用 `window.TransitData.buildLineIndex()` 与 `window.TransitData.createStationPicker()`。
- `src/fareCalculator.js`：已使用 `window.TransitData.buildLineIndex()` 与 `window.TransitData.createStationPicker()`。
- `src/stationGuide.js`：已使用 `window.TransitData.buildLineIndex()` 与 `window.TransitData.createStationPicker()`。
- 因此本轮应增强 `transitData.js` 的共享选择器，而不是给这些页面复制新逻辑。

## 9. `stationGuide.js` 当前如何加载 `station_details.json`

- `init()` 里通过 `Promise.all()` 同时请求：
  - `data/_station.json`
  - `loadTimetableData()`
  - `fetch('data/station_details.json').catch(() => null)`
- 如果响应成功：`state.details = await detailsResponse.json()`。
- `renderRealStationInfo(stationName, adjacency)` 读取 `state.details[stationName]`。
- 当前支持旧字段：
  - `sourceName`
  - `sourceUrl`
  - `guideMapUrl`
  - `knownExits`
  - `exitCountText`
  - `nearby`
  - `services`
  - `tips`
- 如果没有本地详情，会展示官方查询入口，不应报错。

## 10. `scripts/smoke_test_pages.js` 当前检查功能

- `lines.js` 能渲染线路按钮。
- `stations.js` 能渲染线路按钮。
- `trains.js` 能渲染 `19号线` 车次。
- `query.js` 能加载数据，`#data-status` 变成 `数据已就绪`。
- 查询按钮不再 disabled。
- 查询页站点选择器菜单包含 `西直门`。
- 调用 `context.getRoute()` 后，`#result.innerHTML` 包含 `乘车方案`。
- 地图页 HTML 包含 `#subwayMap`、`src/mapExplorer.js`、`#mapViewport`。
- `src/mapExplorer.js` 包含 `nextArrivals` 和 `station-hit`。
- 所有 `data/*.json` 文件小于 25MB。

## Existing Baseline Notes

- `calculateActualTime()` 的 fallback 2 分钟是既有行为，适合展示兜底，但不能作为比较“最短时间”和“最少换乘”的静态算法口径。
- 当前 query 结果的彩色线路横线依赖 `buildRouteLineDiagram()`，属于必须保护的 UI。
- 当前 `query.js` 仍包含 fallback 选择器搜索逻辑；后续可改成只调用 `TransitData.createStationPicker()`，但必须保持 `getRoute()`、`setTravelRequirement()`、`swapRouteEndpoints()` 等全局函数兼容。
- 新增 `scripts/audit_route_baseline.js` 后发现当前基线已有问题：`西直门 -> 北京南站`、`国贸 -> 西二旗`、`宋家庄 -> 东直门` 的 `dijkstraShortestPath().totalTime` 大于 `dijkstraLeastTransfers().totalTime`。原因从代码看不是 UI 渲染，而是两种算法对换乘/方向变化的计时口径不同：最短时间算法把同线不同方向也加 5 分钟，最少换乘算法只比较线路变化。
- `海淀黄庄 -> 蓟门桥` 在当前数据中 `蓟门桥` 不存在，因此基线脚本按 missing station 跳过。
