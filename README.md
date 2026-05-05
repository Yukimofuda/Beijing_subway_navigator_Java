# Beijing Subway Navigator HTML

一个基于原生 HTML、CSS 与 JavaScript 的北京地铁导航系统。项目支持地铁线路查询、列车时刻表浏览、站点详情查看、线路图缩放浏览，以及基础线路管理操作。

## 项目亮点

- 最短时间与最少换乘两种路线查询模式
- 出发站点与目的站点支持输入搜索、线路筛选、站点下拉选择
- 工作日与双休日时刻表分片加载，避免单个 JSON 文件过大
- 支持按线路查看车次，并进入车次详情页
- 支持按站点数据查看线路与区间信息
- 内置北京地铁 SVG 线路图查看器，支持拖拽、滚轮缩放、双击放大
- 支持新增线路与删除站点，并同步更新站点数据和时刻表分片
- 提供本地静态服务，避免浏览器 `file://` 模式下无法加载 JSON

## 技术栈

- HTML5
- CSS3
- Vanilla JavaScript
- Node.js
- Express

项目不依赖前端构建工具，页面逻辑位于 `src/`，样式位于 `style/styles.css`。

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/Yukimofuda/Beijing_subway_navigator_html.git
cd Beijing_subway_navigator_html
```

### 2. 启动本地服务

推荐使用一键脚本：

```bash
./scripts/start_local_server.sh
```

或手动启动：

```bash
node src/Node.js
```

然后在浏览器打开：

```text
http://localhost:3000
```

如果 `3000` 端口被占用，服务会自动尝试后续端口。不要直接双击 HTML 文件打开，因为浏览器会限制 `file://` 页面读取本地 JSON 数据。

## 页面入口

- `index.html`：首页
- `query.html`：线路查询
- `lines.html`：按线路查看车次
- `trains.html`：车次列表
- `train_details.html`：车次详情
- `stations.html`：线路/站点信息入口
- `line_details.html`：线路详情
- `timetable.html`：时刻表浏览
- `Map.html`：北京地铁线路图查看器

## 数据文件

数据位于 `data/`：

- `_station.json`：站点、线路、区间距离与速度数据
- `timetable.workday.json`：工作日时刻表
- `timetable.weekend.json`：双休日时刻表

时刻表原始大文件已经拆分为多个小文件，便于上传 GitHub。当前 JSON 文件大小均小于 25MB。

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
│   ├── lineManagement.js
│   ├── line_details.js
│   ├── lines.js
│   ├── query.js
│   ├── stations.js
│   ├── timetableLoader.js
│   ├── trains.js
│   └── ui.js
├── style/
│   └── styles.css
├── index.html
├── query.html
├── lines.html
├── trains.html
├── train_details.html
├── stations.html
├── line_details.html
├── timetable.html
└── Map.html
```

## 功能说明

### 路线查询

`query.html` 支持：

- 输入站点名称进行搜索
- 按线路筛选站点
- 从站点下拉框直接选择
- 最短时间模式
- 最少换乘模式

路线计算基于地铁网络图构建，并使用 Dijkstra 思路进行路径搜索。

### 时刻表加载

时刻表通过 `src/timetableLoader.js` 统一加载：

```text
data/timetable.workday.json
data/timetable.weekend.json
```

前端会合并分片数据，保持页面使用的数据结构一致。

### 线路管理

`src/lineManagement.js` 提供新增线路和删除站点功能：

- 新增线路会更新站点图数据和时刻表数据
- 删除站点会同步清理 `_station.json` 与两个时刻表分片
- 服务端接口位于 `src/Node.js`

## 验证

运行冒烟测试：

```bash
node scripts/smoke_test_pages.js
```

测试覆盖：

- 线路列表渲染
- 站点列表渲染
- `19号线` 车次渲染
- 查询页数据加载与结果渲染
- 地图页面结构
- JSON 文件大小是否小于 25MB

## 数据拆分

如果未来需要重新拆分完整时刻表文件，可以使用：

```bash
node scripts/split_timetable.js data/timetable.full.json
```

拆分后会生成：

```text
data/timetable.workday.json
data/timetable.weekend.json
```

## 注意事项

- 本项目需要通过本地 HTTP 服务访问，不能依赖 `file://` 直接打开
- 修改数据后建议运行 `node scripts/smoke_test_pages.js`
- 上传 GitHub 前请确认 `data/` 中所有 JSON 文件均小于 25MB
- `.DS_Store`、`.server-info.json`、`node_modules/` 已加入 `.gitignore`

