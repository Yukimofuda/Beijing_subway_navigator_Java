# Frontend Page Audit

## 1. 全局问题

- 问题：主要页面能加载，但当前页面导航没有明确高亮，用户在多页面跳转时缺少位置反馈。
  - 影响：从首页进入查询、票价、导览等页面后，页面归属感弱。
  - 具体页面：index.html、query.html、Map.html、fare_calculator.html、station_guide.html、service_board.html、lines.html、stations.html、trains.html、timetable.html。
  - 建议修复：在 src/ui.js 中根据 location.pathname 给当前导航链接增加 is-active 状态，并在 style/styles.css 追加局部样式。
- 问题：部分结果区初始状态为空白或只有弱提示。
  - 影响：用户不知道下一步该输入什么，尤其是 query.html 与 fare_calculator.html 的结果面板。
  - 具体页面：query.html、fare_calculator.html、trains.html。
  - 建议修复：补充轻量空状态卡片，说明需要选择站点或线路后再查询。
- 问题：站点选择器已修复为 click/focus 显示全集，但真实数据中没有 12号线站点和蓟门桥站点。
  - 影响：输入 12 可以看到 12号线候选，但点击后无法显示站点；输入蓟门不能匹配蓟门桥，因为 data/_station.json 没有该站。
  - 具体页面：query.html、Map.html、fare_calculator.html、station_guide.html。
  - 建议修复：不能伪造站点；后续应补充 data/_station.json 与 timetable 数据后再显示这些站。

## 2. 页面逐项检查

### index.html

#### 已落实的功能
- 页面可正常打开，首页标题、说明和功能入口卡片完整。
- 功能卡片链接清晰，背景图片保留，整体不像空白测试页。

#### 未落实或有 bug 的功能
- 未发现阻断性加载错误。

#### UI/UX 问题
- 功能卡片视觉面积较大，部分卡片信息密度偏低。
- 当前页面和子页面之间缺少统一的导航激活状态。

#### 建议修改
- 保留现有入口结构，仅给导航链接增加当前页高亮。

### query.html

#### 已落实的功能
- 数据状态可变为“数据已就绪”，查询按钮可用。
- 出发站和目的站选择器共用 TransitData.createStationPicker。
- 已选择“西直门”后再次点击输入框，菜单显示全部站点，并包含积水潭。
- 输入“12”可以出现 12号线候选；点击 12号线不会自动选择第一个站点。
- 选择 10号线后，站点按线路顺序显示，且不触发 stationchange。
- 查询结果保留 route-line-visual、route-line-block、route-line-track、route-station-strip 等线路颜色横线和沿途站点结构。

#### 未落实或有 bug 的功能
- data/_station.json 缺少蓟门桥，输入“蓟门”无法真实匹配该站。
- data/_station.json 和时刻表缺少 12号线站点，点击 12号线后只能提示暂无站点数据。
- 浏览器隔离环境下 top-level 函数不稳定暴露给 window，建议显式挂载 getRoute、setTravelRequirement、swapRouteEndpoints 等兼容入口。

#### UI/UX 问题
- 初始 result 区域为空，用户未查询时缺少明确空状态。
- 未选站点时仍使用 alert，体验较硬，但本轮不重写交互。

#### 建议修改
- 给 result 增加初始空状态。
- 显式暴露原有全局函数，保持 inline onclick 和测试环境兼容。
- 不改 dijkstraShortestPath / dijkstraLeastTransfers 核心算法。

### Map.html

#### 已落实的功能
- SVG 地图正常显示，缩放、拖动、站点信息面板和下一班车信息可读。
- 站点搜索选择器行为与 query.html 一致，打开输入框显示全部站点。

#### 未落实或有 bug 的功能
- data/_station.json 缺少蓟门桥与 12号线真实站点，地图搜索无法补出不存在的数据。

#### UI/UX 问题
- 初始地图在大视口中显得偏小，留白较多。
- 信息面板可读，但搜索结果与地图定位之间仍可进一步加强。

#### 建议修改
- 本轮不重写地图缩放逻辑；保留现有交互。
- 后续可增加“设为起点 / 设为终点”跳转 query.html。

### fare_calculator.html

#### 已落实的功能
- 起终点选择器使用同一套 TransitData.createStationPicker 行为。
- “测算”“交换”按钮在浏览器中位于票价卡片内部，未贴到页面左边界。
- 票价结果区域存在空状态提示。

#### 未落实或有 bug 的功能
- 未发现当前阻断性问题。

#### UI/UX 问题
- 按钮组局部样式需要保持为页面级 class，避免后续全局 .btn 改动造成回归。

#### 建议修改
- 保留 .fare-actions 局部布局规则。
- 增加审计脚本继续检查按钮容器存在。

### station_guide.html

#### 已落实的功能
- 站点选择器使用 TransitData.createStationPicker。
- 浏览器中可显示 404 个站点候选，数量与 data/_station.json 一致。
- 点击已填站点输入框会显示全部站点。
- 无详情时页面显示提示，不因缺少详情数据报错。

#### 未落实或有 bug 的功能
- data/_station.json 缺少蓟门桥，因此导览页不能显示该站。

#### UI/UX 问题
- 站点详情区分块已经可读，但设施数据覆盖取决于 data/station_details.json。
- 站点不存在时应保持友好空状态。

#### 建议修改
- 保持 _station.json 为站点全集，不能因为无时刻表或无详情删站。
- 保留并增强设施信息分区。

### service_board.html

#### 已落实的功能
- 运营看板正常加载，当前时间、线路状态、首末班和下一班信息可读。
- 页面整体像运营信息面板，卡片结构清楚。

#### 未落实或有 bug 的功能
- 未发现阻断性加载错误。

#### UI/UX 问题
- 长线路列表的信息密度较高，后续可增加 sticky header 或更强筛选状态。

#### 建议修改
- 本轮只做测试覆盖，不重写看板逻辑。

### lines.html / stations.html / trains.html / timetable.html

#### 已落实的功能
- 页面均可正常打开，表格和详情容器不是空白。
- lines.html、stations.html、timetable.html 信息结构基本整齐。

#### 未落实或有 bug 的功能
- trains.html 无 line 参数时显示“未找到该线路车次”，语义更像错误而不是引导。

#### UI/UX 问题
- 长列表和表格在小屏下仍需重点关注横向滚动与粘性表头。

#### 建议修改
- 增加前端页面加载审计脚本，先保证主要容器、按钮、输入框和页面正文存在。
