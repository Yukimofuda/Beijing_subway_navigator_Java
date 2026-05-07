# Beijing Subway Navigator HTML

一个基于原生 HTML、CSS、JavaScript 与本地 Node 服务的北京地铁导航网页项目。公共交通网站的出行工作台，强调路线规划、线路图浏览、运行状态、票价测算与站点服务的一体化体验。

## 版本重点

- 全站 UI 重构：采用更简洁实用的公共交通服务风格，保留原有背景图片，重新设计按钮、卡片、阴影、选中态、悬浮态与页面转场。
- 首页重排：功能入口按真实出行任务组织。
- 查询页升级：出发站点与目的站点改为“输入框 + 线路/站点候选”合并控件，输入 `12` 可筛出 `12号线`，输入 `蓟门` 可筛出 `蓟门桥` 等站点。
- 地图页重做：线路图改为大图浏览器，支持拖拽、滚轮缩放、双击放大、缩放重置、站点悬浮高亮与中文站点下一班车查询。
- 新增出行场景功能：运行看板、票价与距离测算、站点导览，覆盖实际乘客常见需求。
- 稳健性增强：统一加载 `data/timetable.workday.json` 与 `data/timetable.weekend.json`，修复浏览器返回后页面动画状态导致面板不可见的问题。

## 设计参考

本版本的页面组织参考了新加坡、香港、台北公共交通网站常见的信息架构：先解决旅客的核心任务，再提供线路状态、票价、站点与地图辅助信息。

- Singapore LTA Train System Map: https://www.lta.gov.sg/content/ltagov/en/map/train.html
- SimplyGo / TransitLink: https://www.simplygo.com.sg/
- Hong Kong MTR: https://www.mtr.com.hk/
- Taipei Metro: https://english.metro.taipei/

## 页面入口

- `index.html`：新版出行工作台首页
- `query.html`：线路查询，支持最短时间与最少换乘
- `Map.html`：交互式北京地铁线路图与站点下一班车查询
- `service_board.html`：线路运行看板
- `fare_calculator.html`：票价与距离测算
- `station_guide.html`：站点导览
- `lines.html`：按线路查看列车时刻表
- `trains.html`：按线路查看车次
- `train_details.html`：车次详情
- `stations.html`：站点与线路信息入口
- `line_details.html`：线路站点详情
- `timetable.html`：日历式时刻表浏览

## 数据文件

数据位于 `data/`：

- `_station.json`：站点、线路、区间距离与速度数据
- `timetable.workday.json`：工作日时刻表
- `timetable.weekend.json`：双休日时刻表

所有 JSON 文件：

- `_station.json`
- `timetable.weekend.json`
- `timetable.workday.json`

## 快速开始

推荐通过本地 HTTP 服务访问

```bash
node src/Node.js
```

然后打开：

```text
http://localhost:3000
```

如果 `3000` 端口被占用，服务会自动尝试后续端口。

也可以使用脚本启动：

```bash
./scripts/start_local_server.sh
```

## 验证

运行冒烟测试：

```bash
node scripts/smoke_test_pages.js
```

测试覆盖：

- 线路列表渲染
- 站点列表渲染
- `19号线` 车次渲染
- 查询页数据加载与路线结果渲染
- 地图页交互脚本结构
- JSON 文件大小检查

## 项目结构

```text
.
├── data/
│   ├── _station.json
│   ├── timetable.weekend.json
│   └── timetable.workday.json
├── scripts/
│   ├── smoke_test_pages.js
│   ├── split_timetable.js
│   └── start_local_server.sh
├── src/
│   ├── Node.js
│   ├── fareCalculator.js
│   ├── lineManagement.js
│   ├── line_details.js
│   ├── lines.js
│   ├── mapExplorer.js
│   ├── query.js
│   ├── serviceBoard.js
│   ├── stationGuide.js
│   ├── stations.js
│   ├── timetableLoader.js
│   ├── trains.js
│   └── ui.js
├── style/
│   └── styles.css
├── index.html
├── query.html
├── Map.html
├── service_board.html
├── fare_calculator.html
└── station_guide.html
```

## 说明

- 地图页会加载 SVG 并为英文站点标注建立悬浮命中区；能匹配到中文站名的站点会显示下一班车信息，未匹配的站点可通过左侧中文站点搜索框查询。
- 修改站点或时刻表数据后，建议重新运行 `node scripts/smoke_test_pages.js`。
- 本地改动未提交，提交到 GitHub 前请先检查 `git status`。
