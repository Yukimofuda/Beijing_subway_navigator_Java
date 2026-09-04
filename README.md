# Beijing Subway Navigator HTML

一个基于原生 HTML、CSS、JavaScript 与本地 Node 服务的北京地铁导航网页项目。新版将页面从“按钮清单式入口”重构为更接近公共交通网站的出行工作台，强调路线规划、线路图浏览、运行状态、票价测算与站点服务的一体化体验。

## 本版本重点

- 全站 UI 重构：采用更简洁实用的公共交通服务风格，保留原有背景图片，重新设计按钮、卡片、阴影、选中态、悬浮态与页面转场。
- 首页重排：功能入口按真实出行任务组织，不再按普通网格顺序堆叠按钮。
- 查询页升级：出发站点与目的站点使用统一的“线路 + 可搜索站点”控件，支持中文片段、线路号和已收录拼音首字母；候选严格来自 `_station.json`，不会伪造不存在的站点。
- 地图页重做：线路图改为大图浏览器，支持触控板双指平移、Ctrl/⌘ 滚动缩放、双击放大、缩放重置、站点悬浮高亮与中文站点下一班车查询。
- 新增出行场景功能：运行看板、票价与距离测算、站点导览，覆盖实际乘客常见需求。
- 鲁棒性增强：统一加载 `data/timetable.workday.json` 与 `data/timetable.weekend.json`，修复浏览器返回后页面动画状态导致面板不可见的问题。

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

所有 JSON 文件当前均小于 GitHub 单文件 25MB 上传限制：

- `_station.json`：约 0.21MB
- `timetable.weekend.json`：约 11.13MB
- `timetable.workday.json`：约 14.73MB

## 快速开始

推荐通过本地 HTTP 服务访问，不要直接双击 HTML 文件打开。

```bash
npm install
npm start
```

然后打开：

```text
http://localhost:3000
```

如果 `3000` 端口被占用，服务会自动尝试后续端口。

局域网部署可显式监听所有网卡：

```bash
HOST=0.0.0.0 PORT=3000 npm start
```

## 数据 API

页面优先通过同源 API 读取数据；静态托管时自动回退到 `data/` 中的 JSON，不会出现“只有界面没有数据”的空壳状态。

- `GET /api/health`：运行模式与读写能力
- `GET /api/network`：站点、线路、时刻表覆盖概览
- `GET /api/stations`：完整站点图
- `GET /api/stations/:stationName`：单站点数据
- `GET /api/lines`：线路索引摘要
- `GET /api/timetable?day=workday|weekend`：分片时刻表
- `GET /api/station-details`：本地站点导览数据

线路管理写接口仅在本地 Node 服务中开放；公共托管构建会明确返回只读模式。

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

检查 SVG 英文站点与中文站点的匹配覆盖率：

```bash
node scripts/audit_svg_station_mapping.js
```

如果输出 `Unmatched aliases`，在 `data/svg_station_aliases.json` 中按如下格式补充即可：

```json
{
  "English_Station_Key": "中文站点名"
}
```

`English_Station_Key` 来自脚本输出，中文站点名必须和 `data/_station.json` 中的站名完全一致。

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
│   ├── transitApi.js
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

- 地图页会加载 SVG 并为可核验的英文站点标注建立悬浮命中区；数据站点总数与 SVG 图面命中数分别展示。缺少可信图面坐标的站点仍可搜索和规划，但不会被放到虚构位置。
- 修改站点或时刻表数据后，建议重新运行 `node scripts/smoke_test_pages.js`。
