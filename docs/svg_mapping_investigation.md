# SVG 站点映射只读证据核查

核查日期：2026-09-09。范围：当前仓库的 `data/_station.json`、`Beijing_Subway_System_Map.svg`、既有别名和映射代码。只新增本报告与 `data/svg_station_mapping_review.json`；没有修改地图、站点数据、别名表、UI 或脚本，没有提交。

## 1. 可供整合任务直接采用的结论

**原图实际包含注册表 404 站中的 402 站；312 不是原图容量上限。原先 92 个未匹配项中，90 个是算法/别名遗漏，只有南八里庄、红庙 2 个确实没有原图站点。**

| 原先 92 项的互斥原因 | 站数 |
| --- | ---: |
| 删除数字后缀，把不同车站沿用的 id 前缀当成同站 | 64 |
| 既有别名配错：US、Shiyuan、SUP | 3 |
| 旧名/错误拼写 id 未补别名 | 11 |
| 可读文字位于无 id 的 g 分组 | 5 |
| 可读文字被拆成未分组的 path | 7 |
| 原图没有本站标签或圆点 | 2 |
| 合计 | 92 |

- 原图有 **417 个不同站名标签 = 410 个直接 g 标签 + 7 组散落文字 path**。
- 与注册表交集为 **402**；图中另有 **15** 个注册表以外的站名。没有把它们冒充注册表站点来凑数。
- 旧算法计入 312 个规范中文名，但只有 **311 个具有正确标签绑定**。另外一个是 **新首钢**：旧别名把远在昌平的沙河高教园当成了新首钢，而真正的新首钢标签又被归并为四道桥。
- 按 410 个前景文字分组审查，发现 **83 个有别名但站名错误的绑定**：68 个误绑注册表内车站，15 个误绑注册表外车站。这是实际点击/悬停错站，不只是覆盖率计数问题。
- 可不更换 SVG 修至 **402/404 个有真实文字位置**；若要求 404 个真实图面点，必须先解决两个非运营/历史规划数据条目的图源与状态。不得插值、猜坐标或把相邻站当作本站。

机器证据文件含全部 **404** 项 `station_review`，每项明确存在性、新图源需求、精确原生 id 或结构选择器；另列 15 项底图额外站、83 项旧误绑定及全部图层清单。

## 2. source SVG 版本：已经逐字节确认，不是按文件名猜测

| 项目 | 值 |
| --- | --- |
| 本地 SVG 大小 | 6,217,377 bytes |
| SHA-256 | `5186d795a75a28e34b0a96b845d094f326916df21c202601aec97ae2f88f647c` |
| 画布 / viewBox | 1648 × 1648 / `0 0 1648 1648` |
| 与本地逐字节一致的上游版本 | **2025-01-19 11:48:54 UTC** |
| 上游作者与版本说明 | Painjet；16 号线丽泽商务区站启用 |
| 授权 | CC BY-SA 4.0 |

核对了[作者文件历史](https://commons.wikimedia.org/wiki/File:Beijing_Subway_System_Map.svg)，并将[对应归档 SVG](https://upload.wikimedia.org/wikipedia/commons/archive/0/07/20250608114238%21Beijing_Subway_System_Map.svg)仅载入内存：大小、SHA-256、整个字节串均与本地一致。**归档 URL 的 `20250608114238` 是后续覆盖归档的时间，不是这版图的发布时间。** 另比对了[上一版归档](https://upload.wikimedia.org/wikipedia/commons/archive/0/07/20250119114854%21Beijing_Subway_System_Map.svg)：6,217,198 bytes，SHA-256 为 `aec808529e1d248c552ea8145bf2530011a8f373c12dd345424e4c37107307c8`，并不相同。

原 SVG 没有 `title`、`desc`、`metadata` 元素，不能从内嵌元数据得知版本。仓库 git 中的 2026 年导入/重传记录、2025 年本地修改时间均不能代替地图版本证据。核查时上游历史最新项为 2026-06-29、2400 × 2400，与本图不是同一坐标空间；本次未替换或采用该新版几何。[版本及授权依据](https://commons.wikimedia.org/wiki/File:Beijing_Subway_System_Map.svg)

## 3. 为什么只扫 en_ 会得出错误结论

### 3.1 中文 id 已全部检查；中文站名并没有藏在另一个可读文本层

完整 XML 树共有 35 个顶层图层，850 个 id，id 本身没有重名；其中 811 个以 `en_` 开头。其余 id 为中文图层/线路名，以及 4 个路径对象 id。**没有站名级中文 id；图面是英文/拼音版本，不是带隐藏中文 text 的双语 SVG。**

全图有 11,919 个 path、1,022 个 g；`text` 和 `tspan` 都为 0。肉眼可读的站名已经转为矢量轮廓，`textContent`、中文字符串搜索、只读 id 都无法读出真正显示的文字。本次将 `#站名` 的全部 410 个直接 g 分组逐个渲染核读，并逐一拆分检查全部无 id 的直接 path，不使用自动 OCR 输出替代核验。

### 3.2 两个文字图层，不等于两套车站

- `#站名白底`：486 个直接元素，409 个 g、77 个直接 path；后代 path 总数 5,123。
- `#站名`：530 个直接元素，410 个 g、119 个直接 path、1 个 line；后代 path 总数 5,175。
- 白底大多是同一字形的白色描边。对每个标签按文档顺序连接原始 `path d`，计算 SHA-256，匹配其白底副本，而不是删后缀猜配对。
- 蓟门桥、三元桥、大钟寺、朱房北未找到完全相同 d 序列的白底分组；这不影响已有前景标签，也不能强行分配“看起来像”的副本。JSON 只记录精确匹配的白底证据。
- `#站名` 的 119 个直接 path 中，**77 个组成 7 个站名，其余 42 个是铁路等图标**；额外 line 是图形引线，不是站名。

### 3.3 数字后缀的语义不可靠

`src/mapExplorer.js` 的 `wireStationHover()` 只选 `[id^="en_"]`，`cleanSvgId()` 再执行 `replace(/-\d+$/, '')`。但是原图修改过程中反复复制旧对象、替换字形，却保留旧 id/data-name 前缀：

| 精确原生 id | 真正显示 | 被旧算法错误解析 |
| --- | --- | --- |
| `en_Muxidi-4` | 玉渊潭东门 | 木樨地 |
| `en_Ciqu-8` | 嘉会湖 | 次渠 |
| `en_Guang_anmennei-10` | 牛街 | 广安门内 |
| `en_Guang_anmennei-16` | 景风门 | 广安门内 |
| `en_Hualikan-6` | 2 号航站楼 | 花梨坎 |
| `en_Hualikan-9` | 大兴机场 | 花梨坎 |
| `en_Rongchangdongjie-17` | 经海一路 | 荣昌东街 |
| `en_Rongchangdongjie-29` | 屈庄 | 荣昌东街 |
| `en_Tiantongyuan_North-5` | 未来科学城北 | 天通苑北 |

原先 92 项中共有 64 站受此影响，涉及 25 个前缀族。并不是每个 `-2` 都只表示白底副本。`data-name` 同样保留旧名，不能作独立站名真值。

### 3.4 别名自身也有错；旧 id 不等于图面仍用旧名

- `US → 双桥` 错；原始 `en_US-2` 为 **Huanqiu Dujiaqu (Universal Resort)**，应为环球度假区。
- `Shiyuan → 十里堡` 错；`en_Shiyuan-2` 为 **Huazhuang**，应为花庄。
- `SUP → 新首钢` 错；`en_SUP-2` 为 **Shahe Gaojiaoyuan**，应为沙河高教园。真实新首钢是 `en_Sidaoqiao-6`。
- `en_Lishuiqiao-4` 显示 Liuliqiao（六里桥），而 `en_Lishuiqiao-3` 显示 Lishuiqiao（立水桥），不可混同。
- `Pingguoyuannanlu` 的字形已是 Yangzhuang（杨庄）；`Dougezhuang` 已是 Langxinzhuang（郎辛庄）；`Xiaomazhuang` 已是 Qunfang（群芳）；`Yunjingdonglu` 已是 Wanshengdong（万盛东）。其余旧 id 见逐站表。
- 金鱼胡同原图拼作 **Jingyu Hutong**；四海庄原图为 **Sihaizhuang**。图面拼写差异不是新车站。九号村放大核对确为 **Jiuhaocun**。T1 的标准中文名及站序亦由[京港地铁站间距表](https://www.mtr.bj.cn/service/line/distable/Yizhuang%20T1%20Line.html)交叉确认。

### 3.5 旧审计脚本的 404/404 不是图面覆盖

实际执行 `node scripts/audit_svg_station_mapping.js` 输出：328 个归一化英文 key、316 个别名命中、12 个未配别名、0 个无效中文名、注册表 404/404。

316 是 key 数，不是唯一车站数；关庄、管庄各有两个 key，双桥和十里堡又分别被 US、Shiyuan 重复占用，所以去重为 312。12 个未配别名 key 中，11 个对应确实遗漏的站；**M13S 只是包装层，其内部 `en_Qinghuadongluxikou-2` 已映射清华东路西口**，不能再算缺站。

脚本的 `registryCoverage` 与 `stationNames.size` 都从同一 `Object.keys(stations)` 得出，比较必然相等；且不会检查错误字形绑定。向 SVG 注入 404 项 `station-json-registry` 元数据只能证明可查询站名清单完整，不能证明地图有 404 个位置。

## 4. 站点图形与分组关系

26 个线路图层共 **518 个直接 circle**。另有 `#换乘站` 的 178 个 circle、354 个 path、354 个 polygon，图例与北箭头合计 5 个 circle；总 circle 数 701。换乘图形有外圈/内圈、重复线路节点，不能把 701 或 518 当唯一站数。全图没有 transform 属性，但线路示意图仍不是经纬度地图。

| 线路图层原生 id | 直接车站 circle 数 |
| --- | ---: |
| `昌平线` | 20 |
| `首都机场线` | 5 |
| `大兴机场线` | 3 |
| `亦庄T1线` | 15 |
| `西郊线` | 6 |
| `_19号线` | 10 |
| `_17号线` | 16 |
| `_16号线` | 27 |
| `_15号线` | 20 |
| `_14号线` | 34 |
| `_13号线` | 17 |
| `_12号线` | 20 |
| `_11号线` | 4 |
| `房山燕房线` | 25 |
| `_10号线` | 45 |
| `_4号线-大兴线` | 34 |
| `_9号线` | 13 |
| `_7号线` | 30 |
| `_6号线` | 34 |
| `_8号线` | 34 |
| `亦庄线` | 14 |
| `_5号线` | 23 |
| `_3号线` | 8 |
| `_2号线` | 17 |
| `_1号线-八通线` | 36 |
| `S1线` | 8 |

线路圆点没有站点级语义 id，通常与文字分组是不同顶层图层中的兄弟内容；“找到一个中文线路 id”并不代表找到了同名车站。`#虚拟换乘` 有 4 条 path，属于换乘关系，不是新车站。

本次对 90 个恢复标签检查了其与线路圆点的邻近关系，并放大核对两段真实缺站区间。最近点只用于交叉检查，**未将最近圆点自动认定为本站**：例如丽泽商务区标签边界也接近菜户营圆点，雍和宫文字也靠近安定门，不能全局贪心最近邻。JSON 不输出推测圆心，只保留直接可用的真实标签元素证据。

## 5. 无 id 和散落 path 的精确定位

选择器仅对本报告锁定的原 SVG 哈希有效。`nth-child` 是父图层直接**元素**子节点的 1-based 序号，不是第几个 g/path。这类标签没有专属 SVG id，应如实报告，不能临时杜撰成 `zh_站名` 冒充原生 id。

### 5.1 五个无 id 的 g

| 站名 | 原始结构选择器 | 可读字形 |
| --- | --- | --- |
| 雍和宫 | `#站名 > :nth-child(56)` | Yonghegong |
| 海淀五路居 | `#站名 > :nth-child(103)` | Haidian Wuluju |
| 望京西 | `#站名 > :nth-child(489)` | Wangjingxi |
| 望京 | `#站名 > :nth-child(490)` | Wangjing |
| 望京东 | `#站名 > :nth-child(488)` | Wangjingdong |

### 5.2 七个散落字形标签

以下范围都属于 `#站名` 的直接子元素。每个完整标签需要收集范围内全部 path，而不是只取第一个字母。JSON 已逐项展开为精确选择器，并提供拼接原始 d 的 SHA-256。

| 站名 | 直接子元素序号 | path 数 | 可读字形 |
| --- | --- | ---: | --- |
| 车公庄 | 63–76 | 14 | Chegong-zhuang |
| 平安里 | 197–205 | 9 | Ping'anli |
| 白石桥南 | 127–139 | 13 | Baishiqiaonan |
| 二里沟 | 140–146 | 7 | Erligou |
| 车公庄西 | 111–126 | 16 | Chegong-zhuangxi |
| 北海北 | 147–155 | 9 | Beihaibei |
| 什刹海 | 156–164 | 9 | Shichahai |

## 6. 原 92 个未匹配站：逐站证据

“存在”表示在本版原图能核验文字/站点表达，不承诺该站当前运营。没有本站 id 的记录明确用父图层和结构序号定位；完整 selectors 与字形哈希见 JSON。“需要新图源”仅针对取得真实图面位置，不是要求整张地图必须替换。

| 注册表站名 | 原图存在 | 目视可读标签 | 原生 id / 结构位置 | 原因 | 新图源需求 |
| --- | --- | --- | --- | --- | --- |
| 车公庄 | 是 | Chegong-zhuang | 无本站 id；`#站名` 子元素 63–76 | 散落文字 path | 不需要 |
| 雍和宫 | 是 | Yonghegong | 无本站 id；`#站名` 子元素 56 | 无 id 的文字分组 | 不需要 |
| 平安里 | 是 | Ping'anli | 无本站 id；`#站名` 子元素 197–205 | 散落文字 path | 不需要 |
| 张自忠路 | 是 | Zhangzi-zhong Lu | `en_Dongsi-4` | 不同站名被去数字后缀合并（旧解析：东四） | 不需要 |
| 杨庄 | 是 | Yangzhuang | `en_Pingguoyuannanlu-2` | 旧名或拼写 id 缺别名 | 不需要 |
| 海淀五路居 | 是 | Haidian Wuluju | 无本站 id；`#站名` 子元素 103 | 无 id 的文字分组 | 不需要 |
| 白石桥南 | 是 | Baishiqiaonan | 无本站 id；`#站名` 子元素 127–139 | 散落文字 path | 不需要 |
| 二里沟 | 是 | Erligou | 无本站 id；`#站名` 子元素 140–146 | 散落文字 path | 不需要 |
| 车公庄西 | 是 | Chegong-zhuangxi | 无本站 id；`#站名` 子元素 111–126 | 散落文字 path | 不需要 |
| 北海北 | 是 | Beihaibei | 无本站 id；`#站名` 子元素 147–155 | 散落文字 path | 不需要 |
| 郎辛庄 | 是 | Langxinzhuang | `en_Dougezhuang-2` | 旧名或拼写 id 缺别名 | 不需要 |
| 万盛西 | 是 | Wanshengxi | `en_Wanshengnanjie_Xikou-2` | 旧名或拼写 id 缺别名 | 不需要 |
| 万盛东 | 是 | Wanshengdong | `en_Yunjingdonglu-2` | 旧名或拼写 id 缺别名 | 不需要 |
| 群芳 | 是 | Qunfang | `en_Xiaomazhuang-2` | 旧名或拼写 id 缺别名 | 不需要 |
| 花庄 | 是 | Huazhuang | `en_Shiyuan-2` | 既有别名错误（旧解析：十里堡） | 不需要 |
| 环球度假区 | 是 | Huanqiu Dujiaqu (Universal Resort) | `en_US-2` | 既有别名错误（旧解析：双桥） | 不需要 |
| 霍营 | 是 | Huoying | `en_Yuxin-4` | 不同站名被去数字后缀合并（旧解析：育新） | 不需要 |
| 什刹海 | 是 | Shichahai | 无本站 id；`#站名` 子元素 156–164 | 散落文字 path | 不需要 |
| 金鱼胡同 | 是 | Jingyu Hutong | `en_Wangfujing-4` | 不同站名被去数字后缀合并（旧解析：王府井） | 不需要 |
| 木樨园 | 是 | Muxiyuan | `en_Muxiyuanqiao_North_Muxiyuanqiao-2` | 旧名或拼写 id 缺别名 | 不需要 |
| 海户屯 | 是 | Haihutun | `en_Muxiyuanqiao_South_Muxiyuanqiao-2` | 旧名或拼写 id 缺别名 | 不需要 |
| 大红门南 | 是 | Dahongmennan | `en_Dahongmenqiao_Dahong--2` | 旧名或拼写 id 缺别名 | 不需要 |
| 东高地 | 是 | Donggaodi | `en_Xiwadi-2` | 旧名或拼写 id 缺别名 | 不需要 |
| 火箭万源 | 是 | Huojian Wanyuan | `en_Liuyingmen-2` | 旧名或拼写 id 缺别名 | 不需要 |
| 六里桥东 | 是 | Liuliqiaodong | `en_Lishuiqiao_East-2` | 旧名或拼写 id 缺别名 | 不需要 |
| 六里桥 | 是 | Liuliqiao | `en_Lishuiqiao-4` | 不同站名被去数字后缀合并（旧解析：立水桥） | 不需要 |
| 模式口 | 是 | Moshikou | `en_Pingguoyuan-4` | 不同站名被去数字后缀合并（旧解析：苹果园） | 不需要 |
| 北辛安 | 是 | Beixin'an | `en_Sidaoqiao-5` | 不同站名被去数字后缀合并（旧解析：四道桥） | 不需要 |
| 望京西 | 是 | Wangjingxi | 无本站 id；`#站名` 子元素 489 | 无 id 的文字分组 | 不需要 |
| 南八里庄 | 否 | — | 无本站 id / 标签 / 圆点 | 原图缺站 | 需要补充有来源图形 |
| 红庙 | 否 | — | 无本站 id / 标签 / 圆点 | 原图缺站 | 需要补充有来源图形 |
| 望京 | 是 | Wangjing | 无本站 id；`#站名` 子元素 490 | 无 id 的文字分组 | 不需要 |
| 万泉河桥 | 是 | Wanquanheqiao | `en_Nongdananlu-4` | 不同站名被去数字后缀合并（旧解析：农大南路） | 不需要 |
| 苏州桥 | 是 | Suzhouqiao | `en_Suzhoujie-6` | 不同站名被去数字后缀合并（旧解析：苏州街） | 不需要 |
| 万寿寺 | 是 | Wanshousi | `en_Suzhoujie-7` | 不同站名被去数字后缀合并（旧解析：苏州街） | 不需要 |
| 甘家口 | 是 | Ganjiakou | `en_Suzhoujie-8` | 不同站名被去数字后缀合并（旧解析：苏州街） | 不需要 |
| 玉渊潭东门 | 是 | Yuyuantan Dongmen | `en_Muxidi-4` | 不同站名被去数字后缀合并（旧解析：木樨地） | 不需要 |
| 红莲南路 | 是 | Honglian Nanlu | `en_Guang_anmennei-14` | 不同站名被去数字后缀合并（旧解析：广安门内） | 不需要 |
| 丽泽商务区 | 是 | Lize Shangwuqu | `en_Guang_anmennei-12` | 不同站名被去数字后缀合并（旧解析：广安门内） | 不需要 |
| 东管头南 | 是 | Dongguantounan | `en_Guogongzhuang-8` | 不同站名被去数字后缀合并（旧解析：郭公庄） | 不需要 |
| 富丰桥 | 是 | Fufengqiao | `en_Keyilu-8` | 不同站名被去数字后缀合并（旧解析：科怡路） | 不需要 |
| 看丹 | 是 | Kandan | `en_Keyilu-9` | 不同站名被去数字后缀合并（旧解析：科怡路） | 不需要 |
| 榆树庄 | 是 | Yushuzhuang | `en_Keyilu-10` | 不同站名被去数字后缀合并（旧解析：科怡路） | 不需要 |
| 周家庄 | 是 | Zhoujiazhuang | `en_Ciqu-12` | 不同站名被去数字后缀合并（旧解析：次渠） | 不需要 |
| 十八里店 | 是 | Shibalidian | `en_Ciqu-11` | 不同站名被去数字后缀合并（旧解析：次渠） | 不需要 |
| 北神树 | 是 | Beishenshu | `en_Ciqu-10` | 不同站名被去数字后缀合并（旧解析：次渠） | 不需要 |
| 次渠北 | 是 | Ciqubei | `en_Ciqu-9` | 不同站名被去数字后缀合并（旧解析：次渠） | 不需要 |
| 嘉会湖 | 是 | Jiahuihu | `en_Ciqu-8` | 不同站名被去数字后缀合并（旧解析：次渠） | 不需要 |
| 北太平庄 | 是 | Beitaipingzhuang | `en_Dazhongsi-6` | 不同站名被去数字后缀合并（旧解析：大钟寺） | 不需要 |
| 太平桥 | 是 | Taipingqiao | `en_Fuchengmen-4` | 不同站名被去数字后缀合并（旧解析：阜成门） | 不需要 |
| 牛街 | 是 | Niujie | `en_Guang_anmennei-10` | 不同站名被去数字后缀合并（旧解析：广安门内） | 不需要 |
| 景风门 | 是 | Jingfengmen | `en_Guang_anmennei-16` | 不同站名被去数字后缀合并（旧解析：广安门内） | 不需要 |
| 新发地 | 是 | Xinfadi | `en_Xingong-4` | 不同站名被去数字后缀合并（旧解析：新宫） | 不需要 |
| 大兴新城 | 是 | Daxing Xincheng | `en_Hualikan-8` | 不同站名被去数字后缀合并（旧解析：花梨坎） | 不需要 |
| 大兴机场 | 是 | Daxing Jichang (Daxing Airport) | `en_Hualikan-9` | 不同站名被去数字后缀合并（旧解析：花梨坎） | 不需要 |
| 阎村东 | 是 | Yancundong | `en_Yancun-4` | 不同站名被去数字后缀合并（旧解析：阎村） | 不需要 |
| 沙河高教园 | 是 | Shahe Gaojiaoyuan | `en_SUP-2` | 既有别名错误（旧解析：新首钢） | 不需要 |
| 朱房北 | 是 | Zhufangbei | `en_Beishatan-5` | 不同站名被去数字后缀合并（旧解析：北沙滩） | 不需要 |
| 清河小营桥 | 是 | Qinghe Xiaoyingqiao | `en_Beishatan-4` | 不同站名被去数字后缀合并（旧解析：北沙滩） | 不需要 |
| 学知园 | 是 | Xuezhiyuan | `en_Xitucheng-6` | 不同站名被去数字后缀合并（旧解析：西土城） | 不需要 |
| 学院桥 | 是 | Xueyuanqiao | `en_Xitucheng-7` | 不同站名被去数字后缀合并（旧解析：西土城） | 不需要 |
| 花乡东桥 | 是 | Huaxiang Dongqiao | `en_Guogongzhuang-7` | 不同站名被去数字后缀合并（旧解析：郭公庄） | 不需要 |
| 白盆窑 | 是 | Baipenyao | `en_Guogongzhuang-6` | 不同站名被去数字后缀合并（旧解析：郭公庄） | 不需要 |
| 3号航站楼 | 是 | 3 Hao Hangzhanlou (Terminal 3) | `en_Hualikan-7` | 不同站名被去数字后缀合并（旧解析：花梨坎） | 不需要 |
| 2号航站楼 | 是 | 2 Hao Hangzhanlou (Terminal 2) | `en_Hualikan-6` | 不同站名被去数字后缀合并（旧解析：花梨坎） | 不需要 |
| 定海园 | 是 | Dinghaiyuan | `en_Rongchangdongjie-19` | 不同站名被去数字后缀合并（旧解析：荣昌东街） | 不需要 |
| 定海园西 | 是 | Dinghaiyuanxi | `en_Rongchangdongjie-18` | 不同站名被去数字后缀合并（旧解析：荣昌东街） | 不需要 |
| 经海一路 | 是 | Jinghai Yilu | `en_Rongchangdongjie-17` | 不同站名被去数字后缀合并（旧解析：荣昌东街） | 不需要 |
| 亦创会展中心 | 是 | Yichuang Huizhan Zhongxin | `en_Rongchangdongjie-20` | 不同站名被去数字后缀合并（旧解析：荣昌东街） | 不需要 |
| 亦庄同仁 | 是 | Yizhuang Tongren | `en_Rongchangdongjie-21` | 不同站名被去数字后缀合并（旧解析：荣昌东街） | 不需要 |
| 鹿圈东 | 是 | Lujuandong | `en_Rongchangdongjie-22` | 不同站名被去数字后缀合并（旧解析：荣昌东街） | 不需要 |
| 泰河路 | 是 | Taihe Lu | `en_Rongchangdongjie-23` | 不同站名被去数字后缀合并（旧解析：荣昌东街） | 不需要 |
| 九号村 | 是 | Jiuhaocun | `en_Rongchangdongjie-24` | 不同站名被去数字后缀合并（旧解析：荣昌东街） | 不需要 |
| 四海庄 | 是 | Sihaizhuang | `en_Rongchangdongjie-25` | 不同站名被去数字后缀合并（旧解析：荣昌东街） | 不需要 |
| 太和桥北 | 是 | Taiheqiaobei | `en_Rongchangdongjie-26` | 不同站名被去数字后缀合并（旧解析：荣昌东街） | 不需要 |
| 瑞合庄 | 是 | Ruihezhuang | `en_Rongchangdongjie-27` | 不同站名被去数字后缀合并（旧解析：荣昌东街） | 不需要 |
| 融兴街 | 是 | Rongxing Jie | `en_Rongchangdongjie-28` | 不同站名被去数字后缀合并（旧解析：荣昌东街） | 不需要 |
| 屈庄 | 是 | Quzhuang | `en_Rongchangdongjie-29` | 不同站名被去数字后缀合并（旧解析：荣昌东街） | 不需要 |
| 工人体育场 | 是 | Workers' Stadium | `en_AEC-4` | 不同站名被去数字后缀合并（旧解析：农业展览馆） | 不需要 |
| 左家庄 | 是 | Zuojiazhuang | `en_Guangximen-6` | 不同站名被去数字后缀合并（旧解析：光熙门） | 不需要 |
| 西坝河 | 是 | Xibahe | `en_Guangximen-5` | 不同站名被去数字后缀合并（旧解析：光熙门） | 不需要 |
| 红军营 | 是 | Hongjunying | `en_Tiantongyuan_South-8` | 不同站名被去数字后缀合并（旧解析：天通苑南） | 不需要 |
| 清河营 | 是 | Qingheying | `en_Tiantongyuan_South-7` | 不同站名被去数字后缀合并（旧解析：天通苑南） | 不需要 |
| 天通苑东 | 是 | Tiantongyuandong | `en_Tiantongyuan_South-6` | 不同站名被去数字后缀合并（旧解析：天通苑南） | 不需要 |
| 未来科学城 | 是 | Weilaikexuecheng (Future Science City) | `en_Tiantongyuan_North-6` | 不同站名被去数字后缀合并（旧解析：天通苑北） | 不需要 |
| 未来科学城北 | 是 | Weilaikexuechengbei (Future Science City North) | `en_Tiantongyuan_North-5` | 不同站名被去数字后缀合并（旧解析：天通苑北） | 不需要 |
| 东管头 | 是 | Dongguantou | `en_Guang_anmennei-11` | 不同站名被去数字后缀合并（旧解析：广安门内） | 不需要 |
| 菜户营 | 是 | Caihuying | `en_Guang_anmennei-13` | 不同站名被去数字后缀合并（旧解析：广安门内） | 不需要 |
| 西铁营 | 是 | Xitieying | `en_Guang_anmennei-15` | 不同站名被去数字后缀合并（旧解析：广安门内） | 不需要 |
| 望京东 | 是 | Wangjingdong | 无本站 id；`#站名` 子元素 488 | 无 id 的文字分组 | 不需要 |
| 洪泰庄 | 是 | Hongtaizhuang | `en_Keyilu-11` | 不同站名被去数字后缀合并（旧解析：科怡路） | 不需要 |
| 宛平城 | 是 | Wanpingcheng | `en_Keyilu-12` | 不同站名被去数字后缀合并（旧解析：科怡路） | 不需要 |

## 7. 两个真缺站不是同一个性质，更不能补假点

### 南八里庄

- 注册表内容为 `edge: []`、`lines: []`、`line_siz: 0`。
- 完整 417 标签清单无该站；`#_14号线` 的十里河（子元素 20）至北工大西门（子元素 21）区间只有连续线路，无本站圆点或字形。邻站标签为 `en_Shilihe-2`、`en_West_Gate_of_BUT-2`，**均不是南八里庄的 id**。
- [京港地铁距离表](https://www.mtr.bj.cn/service/line/distable/line-14.html)仍保留其历史区间；[住建委 2014 年工程进展](https://zjw.beijing.gov.cn/bjjs/zwgk46/ywtz/zdgc/743863899/index.shtml)明确记载当时拟取消。由这些证据只能确认其历史/规划数据属性及原图缺失，不能把历史表当成运营证明。
- 如业务必须保留 404 项，保留搜索/详情，并标为缺少原图位置；若需历史规划位置，另找规划图并标清状态。不得将周家庄替换/合并为南八里庄，也不得根据两端距离插值后宣称“原图识别”。

### 红庙

- 注册表同样是空线路、空边。
- `#_14号线` 大望路（子元素 24）与金台路（子元素 25）之间没有红庙站点圆点或文字。邻站标签 `en_Dawanglu-2`、`en_Jintailu-2` 只用于证明搜索区间。
- 官方[站间距表](https://www.mtr.bj.cn/service/line/distable/line-14.html)保留红庙，2026-04-08 的[建设报道](https://zdb.beijing.gov.cn/zdxmjs/gdjtjs/202604/t20260408_4577028.html)涉及红庙施工现场；不能仅因有登记名称就把它当作此版图的运营站。
- 需要包含红庙的合适版本/规划图形，或独立取得经核验的定位资料后进行明确标注的绘图；本次不输出位置。

注册表共有 6 个无邻接边条目：陶然桥、南八里庄、红庙、高家园、朱房北、通运门。**其中另外 4 个都在原 SVG 有标签**，所以“空 edge”不能作为判断图面不存在的算法。原图还明确把通运门、陶然桥、老观里标为待开通；图面/注册表并非同一运营时点。

## 8. 反向差集：底图有、注册表没有的 15 站

这进一步说明 source SVG 的 3/12 号线内容与注册表版本不同，而非 source 一概比数据旧。以下 15 个不同标签均会被旧前缀别名误绑到别的站；必须显式隔离，不能让点击它们查询田村、高家园等站。

| 真实底图站名 | 精确原生 id | 旧算法错误解析 |
| --- | --- | --- |
| 四季青桥 | `en_Tiancun-5` | 田村 |
| 蓝靛厂 | `en_Tiancun-6` | 田村 |
| 蓟门桥 | `en_Xitucheng-8` | 西土城 |
| 将台西 | `en_Sanyuanqiao-4` | 三元桥 |
| 马甸桥 | `en_Dazhongsi-7` | 大钟寺 |
| 安贞桥 | `en_Dazhongsi-8` | 大钟寺 |
| 驼房营 | `en_Gaojiayuan-11` | 高家园 |
| 东坝西 | `en_Gaojiayuan-12` | 高家园 |
| 东坝北 | `en_Gaojiayuan-13` | 高家园 |
| 东坝 | `en_Gaojiayuan-14` | 高家园 |
| 东坝南 | `en_Gaojiayuan-15` | 高家园 |
| 姚家园 | `en_Gaojiayuan-16` | 高家园 |
| 朝阳站 | `en_Gaojiayuan-17` | 高家园 |
| 石佛营 | `en_Gaojiayuan-18` | 高家园 |
| 老观里 | `en_Rongchangdongjie-30` | 荣昌东街 |

## 9. 可实施修复路线与验收标准

### A. 最小、安全方案：保留原图，恢复 402 个真实标签位置

1. 固定本版 SVG SHA-256。读取 JSON 的 `station_review`，只为 `exists_in_source_svg: true` 的 402 项建立站名与 `label_selectors` 的绑定。
2. 优先精确 id；为 5 个匿名 g 使用本版结构选择器；为 7 组 path 合并真实标签包围盒或运行时创建容器。**先保存节点引用再插入新元素**，否则顶层 `nth-child` 序号会变。
3. 每次读取验证元素数量、标签 kind、文档顺序拼接 `path d` 的 SHA-256。采用 `getElementById` 或正确转义 selector；绝不把图层级 id 当本站 id。
4. 废除无条件删数字后缀作为身份判定；白底副本仅按指纹/经核验清单合并，不重复计数。`en_M13S-2` 与内部的清华东路西口算同一个标签。
5. 修复 US、Shiyuan、SUP 与全部 83 项旧误绑定；真实新首钢绑定 `en_Sidaoqiao-6`，不能仅补 92 个缺失名字就结束。
6. 15 个底图额外站不绑定到注册表的其他站；可提示“仅底图有此站，当前数据未收录”，或另做来源明确的完整数据升级。
7. 查询覆盖显示 404；真实标签覆盖显示 402/404；未定位两项显示“无原图位置”。如 UI 用标签包围盒中心做搜索聚焦，应称为标签定位，不能称为地理位置或站台圆心。

该方案不需要换源、不需要假坐标。它完成的是本任务这份 404 注册表的准确对应，不承诺源图和路由数据已更新到 2026 年。

### B. 如果产品字面要求 404 个图上实体

必须先决定展示运营网络还是包含历史/规划层：现有注册表混有无线路条目，单靠更换“最新版运营 SVG”不能保证补上被放弃的历史站。保留 404 原始记录时，可将两个条目放到有官方图源和时间说明的独立规划/历史图层；资料不足就保持无位置，不把占位符计作成功映射。运营模式则应按来源维护可运营站集合，但**本次没有删除或重写任何注册表记录**。

父任务可按用户确认把同作者新图作为附加图源，原图不删除。应先逐项查证附加图是否真的含有南八里庄、红庙，不预先计为补齐。若采用最新英文或中文 SVG，需要重新审核全量标签、坐标系、站名别名、线路版本与授权，并生成新的源哈希绑定证据；禁止把本版 1648 画布的几何/结构索引原样套在 2400 画布上。上游中文文件是另一个图源，不代表本地文件存在可搜索中文标签。[上游文件与中文版本入口](https://commons.wikimedia.org/wiki/File:Beijing_Subway_System_Map.svg)

### C. 验收不得只看总数

- 404 个规范注册表名称恰好各出现一次；有图 402、无图 2，差集恰为南八里庄/红庙。
- 精确 id / 结构选择器全部解析成功；组成站名字形的 path 指纹一致；不同车站不能共享同一标签对象。
- 来源哈希失配立即停用本版结构映射，而不是继续猜。
- 覆盖普通站、同前缀不同站、旧名、拼写差异、匿名 g、拆散 path、包装层、白底副本、底图额外站、图面缺站。
- 特别回归：玉渊潭东门≠木樨地、六里桥≠立水桥、嘉会湖≠次渠、大兴机场≠花梨坎、经海一路≠荣昌东街、环球度假区≠双桥、花庄≠十里堡、新首钢≠沙河高教园。
- 空边条目不推断运营状态；404 名字元数据不冒充 404 地图位置。

## 10. 证据文件约定与本轮验证

`data/svg_station_mapping_review.json` 记录输入文件 SHA-256、精确版本来源、35 个图层、全部 404 站逐项证据、92 项旧差集、15 项反向差集、83 项旧错误绑定。不包含经纬度、推测坐标或生成的站点圆心。

`path_geometry_sha256` 定义：将 `label_selectors` 对应元素按文档序排列，深度优先收集全部后代 path（元素自身为 path 时也计入），取各原始 `d` 字符串，以 LF 分隔，UTF-8 编码后计算 SHA-256。前景标签为 g 时只取一次整个 g 子树，不额外再次取其嵌套 id。

本轮验证包括：XML 全树解析、四页 410 标签逐组渲染、119 个直接 path 全量分类、7 组字形单独放大、两个缺站区间放大、白底 d 指纹交叉检查、上游版本字节比对、旧审计脚本复现，以及生成后证据选择器/字形指纹与计数一致性检查。除约定两份证据文件外，未写入仓库文件。
