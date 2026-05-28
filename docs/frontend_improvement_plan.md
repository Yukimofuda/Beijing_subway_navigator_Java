# Frontend Improvement Plan

## Must Fix

1. 问题：站点选择器打开时不应按已有 input.value 过滤。
   - 页面：query.html、Map.html、fare_calculator.html、station_guide.html
   - 文件：src/transitData.js
   - 修复方式：保持 focus/click 调用 openFullMenu，input 事件才调用搜索过滤。
   - 验收方式：node scripts/audit_station_picker_behavior.js；浏览器点击已填“西直门”的输入框，菜单显示多个站点。

2. 问题：选择线路后不能自动选择站点。
   - 页面：query.html、Map.html、fare_calculator.html、station_guide.html
   - 文件：src/transitData.js
   - 修复方式：点击线路只设置 lineSelect 与候选范围，不写 input.dataset.station，不触发 stationchange。
   - 验收方式：node scripts/audit_station_picker_behavior.js；浏览器点击 10号线，输入框不变成首站。

3. 问题：站点全集必须以 data/_station.json 为准，不能漏站。
   - 页面：query.html、Map.html、fare_calculator.html、station_guide.html
   - 文件：src/transitData.js、src/query.js、src/stationGuide.js、src/fareCalculator.js、src/mapExplorer.js
   - 修复方式：所有页面统一使用 TransitData.buildLineIndex 与 TransitData.createStationPicker。
   - 验收方式：node scripts/audit_station_data_consistency.js。

4. 问题：query.html 结果区初始为空，且 inline onclick 依赖隐式全局函数。
   - 页面：query.html
   - 文件：query.html、src/query.js
   - 修复方式：增加结果区空状态，显式导出 getRoute、setTravelRequirement、swapRouteEndpoints 等兼容函数。
   - 验收方式：node scripts/smoke_test_pages.js；浏览器打开页面无空白结果区。

5. 问题：票价页按钮必须保持在卡片内。
   - 页面：fare_calculator.html
   - 文件：style/styles.css
   - 修复方式：保持 .fare-actions 局部布局规则。
   - 验收方式：浏览器检查按钮左边界在 .tool-panel-body 内。

## Should Improve

1. 改进：当前页面导航高亮。
   - 页面：全站
   - 文件：src/ui.js、style/styles.css
   - 用户价值：用户能快速识别当前功能页。
   - 实现方式：根据 location.pathname 给匹配 href 的链接添加 is-active。
   - 验收方式：浏览器打开页面，返回首页或当前页面链接有高亮状态。

2. 改进：前端页面加载审计脚本。
   - 页面：主要 HTML 页面
   - 文件：scripts/audit_frontend_pages.js
   - 用户价值：防止页面空白、主要容器缺失、脚本路径错误。
   - 实现方式：通过本地 HTTP 读取页面，检查正文、关键按钮、关键输入和主容器。
   - 验收方式：node scripts/audit_frontend_pages.js。

3. 改进：查询页结果空状态。
   - 页面：query.html
   - 文件：query.html、style/styles.css
   - 用户价值：未查询前给出明确下一步。
   - 实现方式：在 #result 中放置轻量 empty-state 卡片。
   - 验收方式：浏览器打开 query.html，未查询时可见操作引导。

## Nice to Have

1. 改进：Map.html 增加“设为起点 / 设为终点”。
   - 页面：Map.html
   - 文件：src/mapExplorer.js
   - 暂不实现原因：需要确认当前站点点击与悬浮数据结构，避免破坏 SVG 交互。

2. 改进：长表格 sticky header。
   - 页面：lines.html、stations.html、trains.html、timetable.html
   - 文件：style/styles.css
   - 暂不实现原因：需要逐页确认真实表格 class，避免误伤其他卡片布局。

3. 改进：补齐 12号线、蓟门桥真实数据。
   - 页面：全站
   - 文件：data/_station.json、data/timetable.workday.json、data/timetable.weekend.json
   - 暂不实现原因：当前任务禁止凭空假设站点和线路数据，必须由真实数据源补充。
