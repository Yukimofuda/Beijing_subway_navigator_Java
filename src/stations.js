document.addEventListener('DOMContentLoaded', () => {
    // 获取用于显示线路按钮的 div 元素
    const lineButtonsDiv = document.getElementById('line-buttons');
    if (!lineButtonsDiv) return;

    // 请求站点数据
    fetch('data/_station.json')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        }) // 解析 JSON 响应
        .then(stationData => {
            // 使用 Set 存储唯一的线路名称
            const uniqueLines = new Set();
            // 遍历站点数据，提取所有线路名称
            for (const station in stationData) {
                // 将每个站点所属的线路添加到 Set 中，自动去重
                stationData[station].lines.forEach(line => uniqueLines.add(line));
            }
            const sortedLines = Array.from(uniqueLines).sort((a, b) => a.localeCompare(b, 'zh-CN'));
            // 遍历唯一的线路名称
            sortedLines.forEach(line => {
                // 创建一个新的 button 元素
                const lineButton = document.createElement('button');
                lineButton.classList.add('line-button');
                // 设置按钮的文本内容为线路名称
                lineButton.textContent = line;
                // 为按钮添加点击事件监听器
                lineButton.addEventListener('click', () => {
                    // 将当前选中的线路名称存储到 localStorage 中
                    localStorage.setItem('currentLine', line);
                    // 跳转到显示线路详细信息的页面
                    window.location.href = 'line_details.html';
                });
                // 将创建的按钮添加到线路按钮容器中
                lineButtonsDiv.appendChild(lineButton);
            });

            if (!sortedLines.length) {
                lineButtonsDiv.innerHTML = '<div class="muted">未找到线路数据</div>';
            }
        })
        .catch(error => {
            console.error('加载站点数据失败:', error);
            lineButtonsDiv.innerHTML = '<div class="muted">站点数据加载失败</div>';
            if (window.showToast) window.showToast('站点数据加载失败');
        }); // 处理加载数据失败的情况
});
