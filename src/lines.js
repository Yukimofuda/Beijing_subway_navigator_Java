// 请求列车时刻表数据
loadTimetableData()
    .then(data => {
        // 获取显示线路按钮的容器
        const linesDiv = document.getElementById('lines');
        if (!linesDiv) return;
        // 使用 Set 存储唯一的线路名称
        const lines = new Set();
        // 遍历时刻表数据，提取唯一的线路名称
        for (const dayType in data) {
            if (data.hasOwnProperty(dayType)) {
                for (const line in data[dayType]) {
                    if (data[dayType].hasOwnProperty(line)) {
                        lines.add(line); // 将线路名称添加到 Set 中
                    }
                }
            }
        }
        const sortedLines = Array.from(lines).sort((a, b) => (
            window.TransitData?.compareLines
                ? window.TransitData.compareLines(a, b)
                : a.localeCompare(b, 'zh-CN')
        ));
        const lineCards = sortedLines.map(line => {
            const lineStationNames = new Set();
            for (const dayType of Object.keys(data || {})) {
                const lineData = data[dayType]?.[line] || {};
                for (const directionData of Object.values(lineData)) {
                    for (const schedule of Object.values(directionData || {})) {
                        if (!Array.isArray(schedule)) continue;
                        schedule.forEach((stop) => {
                            if (stop?.[0]) lineStationNames.add(stop[0]);
                        });
                    }
                }
            }
            const stationCount = lineStationNames.size;
            const lineColor = window.TransitData?.lineColor?.(line) || '#075a9c';
            return `
              <button class="line-button timetable-line-button" type="button" style="--line-color:${lineColor}" onclick="showTrains('${line}')">
                <span class="line-button-mark" aria-hidden="true"></span>
                <span class="line-button-copy">
                    <strong>${line}</strong>
                    <small>${stationCount ? `收录 ${stationCount} 站` : '查看时刻数据'}</small>
                </span>
                <span class="line-button-arrow" aria-hidden="true">›</span>
              </button>
            `;
        });
        linesDiv.innerHTML = lineCards.join('') || '<div class="muted">暂无线路数据</div>';
    })
    .catch(error => {
        console.error('Error:', error);
        const linesDiv = document.getElementById('lines');
        if (linesDiv) linesDiv.innerHTML = '<div class="muted">线路数据加载失败</div>';
        if (window.showToast) window.showToast('时刻表加载失败');
    }); // 处理数据加载错误
// 显示所选线路的列车时刻表
function showTrains(line) {
    // 跳转到显示列车时刻表的页面，并在 URL 中传递所选线路的名称
    window.location.href = `trains.html?line=${encodeURIComponent(line)}`;
}
