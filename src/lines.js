// 请求列车时刻表数据
loadTimetableData()
    .then(data => {
        // 获取显示线路按钮的容器
        const linesDiv = document.getElementById('lines');
        if (!linesDiv) return;
        let linesHTML = '';
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
        const sortedLines = Array.from(lines).sort((a, b) => a.localeCompare(b, 'zh-CN'));
        // 为每个唯一的线路名称创建按钮
        sortedLines.forEach(line => {
            linesHTML += `<button class="line-button" onclick="showTrains('${line}')">${line}</button>`; // 点击按钮时调用 showTrains 函数
        });
        // 将生成的线路按钮添加到页面中
        linesDiv.innerHTML = linesHTML || '<div class="muted">暂无线路数据</div>';
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
