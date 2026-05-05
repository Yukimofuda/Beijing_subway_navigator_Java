document.addEventListener('DOMContentLoaded', () => {
    // 获取显示线路站点详细信息的 div 元素
    const lineStationDetailsDiv = document.getElementById('line-station-details');
    // 从 localStorage 获取当前选中的线路名称
    const currentLine = localStorage.getItem('currentLine');

    // 检查是否存在选中的线路
    if (currentLine) {
        // 请求站点数据
        fetch('data/_station.json')
            .then(response => response.json()) // 解析 JSON 响应
            .then(stationData => {
                // 过滤出属于当前线路的站点名称
                const stationsOnLine = Object.keys(stationData).filter(station =>
                    stationData[station].lines.includes(currentLine)
                );

                // 如果该线路存在站点
                if (stationsOnLine.length > 0) {
                    let maxSpeed = '-';
                    // 查找该线路的最高速度
                    for (const stationName of stationsOnLine) {
                        const stationInfo = stationData[stationName];
                        if (stationInfo.edge) {
                            const edge = stationInfo.edge.find(e => e.line === currentLine);
                            if (edge && edge.speed) {
                                maxSpeed = edge.speed;
                                break; // 找到最高速度后停止循环
                            }
                        }
                    }

                    // 创建显示线路基本信息的 div
                    const lineInfoDiv = document.createElement('div');
                    lineInfoDiv.innerHTML = `<h3>线路名称：${currentLine}</h3><p>最高速度：${maxSpeed} km/h</p>`;
                    lineStationDetailsDiv.appendChild(lineInfoDiv);

                    // 创建用于显示站点详细信息的表格
                    const table = document.createElement('table');
                    let html = `
                        <tr>
                            <th>本站名称</th>
                            <th>下一站名称</th>
                            <th>距离 (米)</th>
                            <th>所需时间 (秒)</th>
                        </tr>
                    `;

                    const orderedStations = [];
                    const visited = new Set();
                    const stationMap = new Map(stationsOnLine.map(station => [station, stationData[station]]));

                    // 从线路名称中提取起始站和终点站
                    const bracketMatch = currentLine.match(/\(([^)]+)\)/);
                    let startStation = null;
                    let endStation = null;
                    if (bracketMatch) {
                        const content = bracketMatch[1];
                        if (content.includes('--')) {
                            [startStation, endStation] = content.split('--');
                        } else if (content.includes('-')) {
                            [startStation, endStation] = content.split('-');
                        }
                    }

                    // 如果无法提取起始站和终点站，则显示错误信息并返回
                    if (!startStation || !endStation) {
                        startStation = stationsOnLine[0];
                        endStation = stationsOnLine[stationsOnLine.length - 1];
                    }

                    // 从起始站开始排序站点
                    orderedStations.push(startStation);
                    visited.add(startStation);
                    let currentStation = startStation;

                    // 遍历站点，按照连接顺序排列
                    while (orderedStations.length < stationsOnLine.length) {
                        const currentInfo = stationMap.get(currentStation);
                        let nextStation = null;

                        if (currentInfo?.edge) {
                            // 查找与当前站点相连且未访问过的下一个站点
                            for (const edge of currentInfo.edge) {
                                if (stationsOnLine.includes(edge.station) && !visited.has(edge.station)) {
                                    nextStation = edge.station;
                                    break;
                                }
                            }
                        }

                        if (nextStation) {
                            orderedStations.push(nextStation);
                            visited.add(nextStation);
                            currentStation = nextStation;
                        } else {
                            break; // 如果没有下一个可访问的站点，则停止循环
                        }
                    }

                    // 处理环线情况，确保终点站被包含
                    if (orderedStations[orderedStations.length - 1] !== endStation) {
                        orderedStations.push(endStation);
                    }

                    // 遍历排序后的站点，生成表格的 HTML
                    for (let i = 0; i < orderedStations.length; i++) {
                        const currentStationName = orderedStations[i];
                        const nextStationName = i < orderedStations.length - 1 ? orderedStations[i + 1] : null;
                        let distance = '-';
                        let time = '-';

                        const currentStationInfo = stationMap.get(currentStationName);
                        if (currentStationInfo?.edge) {
                            // 查找当前站点到下一个站点的连接信息
                            let foundEdge = false;
                            for (const edge of currentStationInfo.edge) {
                                if (edge.station === nextStationName && edge.line === currentLine) {
                                    distance = edge.distance;
                                    time = edge.time ? edge.time.toFixed(2) : '-';
                                    foundEdge = true;
                                    break;
                                }
                            }
                            if (!foundEdge) {
                                console.log(`No edge found between ${currentStationName} and ${nextStationName} on line ${currentLine}`);
                            }
                        }

                        // 添加表格行
                        html += `
                            <tr>
                                <td>${currentStationName}</td>
                                <td>${nextStationName || '-'}</td>
                                <td>${distance}</td>
                                <td>${time}</td>
                            </tr>
                        `;
                    }

                    table.innerHTML = html;
                    lineStationDetailsDiv.appendChild(table);

                } else {
                    lineStationDetailsDiv.textContent = `未找到线路 ${currentLine} 的站点信息。`;
                }
            })
            .catch(error => console.error('加载站点数据失败:', error)); // 处理加载数据失败的情况
    } else {
        lineStationDetailsDiv.textContent = '未选择线路。'; // 如果没有选择线路，则显示提示信息
    }
});
