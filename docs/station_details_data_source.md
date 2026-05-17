# 站点详情数据来源说明

`data/station_details.json` 用于在 `station_guide.html` 展示站内设施、出口、周边与来源信息。前端只读取本地 JSON，不在页面运行时抓取外部网站。

## 数据来源

- 京港地铁站点详情页：优先用于 4 号线、14 号线、16 号线等京港运营线路，来源 URL 写入 `data/station_detail_sources.json`。
- 北京地铁站点及周边信息：用于非京港线路的公开站点入口和补充说明。

## 更新方式

运行 `node scripts/update_station_details_from_mtr.js` 会按 `data/station_detail_sources.json` 中列出的站点离线更新本地详情。抓取失败不会覆盖已有站点数据。

## 字段约定

- `source.provider`、`source.url`、`source.updatedAt` 记录来源。
- `facilities` 下按设施类型保存数组，包含 `toilet`、`accessibleToilet`、`elevator`、`ramp`、`aed`、`ticketMachine`、`serviceCenter`、`policeOffice` 等。
- `exits`、`nearby`、`tips` 保留人工核验补充信息。
