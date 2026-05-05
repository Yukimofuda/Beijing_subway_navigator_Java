# Beijing Subway Navigator (HTML Version)

## 项目简介 | Introduction

本项目是一个基于 Web 的北京地铁导航系统，支持最短路径查询、最少换乘方案计算以及线路可视化展示。系统通过图论建模与路径搜索算法，实现高效的地铁路线规划。

This project is a web-based Beijing Subway navigation system. It supports shortest path queries, minimum transfer route planning, and subway line visualization. The system models the subway network as a graph and uses pathfinding algorithms for efficient route planning.

---

## 功能特性 | Features

- 最短时间路径查询（基于 Dijkstra 算法）
- 最少换乘路径规划
- 地铁线路与站点可视化
- 支持动态添加/删除地铁线路（可扩展）
- JSON 数据驱动（站点、线路、时间表）

- Shortest-time route planning (based on Dijkstra algorithm)
- Minimum-transfer route optimization
- Visualization of subway lines and stations
- Dynamic line management (add/remove lines)
- JSON-based data (stations, lines, timetable)

---

## 项目结构 | Project Structure

```text
Beijing_subway_navigator_html/
├── index.html              # 主页面入口（用户交互界面） | Main entry point (UI)
│
├── css/                    # 样式文件目录 | Stylesheets
│   └── *.css               # 页面布局与视觉设计 | Layout & styling
│
├── js/                     # 核心逻辑模块 | Core logic modules
│   ├── graph.js            # 地铁网络图建模（节点/边定义） | Graph modeling (nodes & edges)
│   ├── dijkstra.js         # 最短路径算法实现 | Dijkstra shortest path algorithm
│   ├── query.js            # 路径查询与调度逻辑 | Route query & control logic
│
├── data/                   # 数据文件（JSON） | Data files (JSON)
│   ├── stations.json       # 站点信息（名称、换乘关系等） | Station data (names, transfers)
│   ├── lines.json          # 地铁线路拓扑结构 | Subway line topology
│   ├── timetable.json      # 运行时间/班次数据 | Timetable / schedule data
│
└── README.md               # 项目说明文档 | Project documentation
```
---

## 核心算法 | Core Algorithm

系统采用 **Dijkstra 算法** 进行最短路径计算：

- 将地铁系统建模为加权图（站点为节点，线路为边）
- 权重可表示时间或换乘成本
- 支持不同策略：
  - 最短时间
  - 最少换乘

The system uses **Dijkstra’s algorithm** for shortest path computation:

- Subway system is modeled as a weighted graph
- Nodes = stations, edges = connections
- Weights represent travel time or transfer cost
- Supports multiple optimization strategies:
  - Shortest time
  - Minimum transfers

---

## 使用方法 | Usage

### 克隆项目 | Clone

```bash
git clone https://github.com/Yukimofuda/Beijing_subway_navigator_html.git
cd Beijing_subway_navigator_html
