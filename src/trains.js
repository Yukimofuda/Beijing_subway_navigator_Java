const urlParams = new URLSearchParams(window.location.search);
const selectedLine = urlParams.get('line') || '';  // 获取 URL 参数中的 "line"

document.title = `车次选择 - ${selectedLine || '线路'}`;
const currentLineEl = document.getElementById('current-line');
if (currentLineEl) currentLineEl.textContent = selectedLine || '-';

function simplifyLineName(lineName) {
  return String(lineName || '')
    .replace(/^地铁/, '')
    .replace(/\(.+\)$/, '')
    .trim();
}

function isSameLine(currentLine, targetLine) {
  return currentLine === targetLine || simplifyLineName(currentLine) === simplifyLineName(targetLine);
}

loadTimetableData()
  .then(data => {
    const trainsDiv = document.getElementById('trains');
    const searchInput = document.getElementById('train-search');
    const countElement = document.getElementById('train-count');
    const moreButton = document.getElementById('train-more');
    const records = new Map();
    let visibleLimit = 80;

    for (const dayType in data) {
      if (data.hasOwnProperty(dayType)) {
        for (const currentLine in data[dayType]) {
          if (data[dayType].hasOwnProperty(currentLine)) {
            if (isSameLine(currentLine, selectedLine)) {  // 找到匹配的线路
              for (const direction in data[dayType][currentLine]) {
                if (data[dayType][currentLine].hasOwnProperty(direction)) {
                  for (const train in data[dayType][currentLine][direction]) {
                    if (data[dayType][currentLine][direction].hasOwnProperty(train)) {
                      const schedule = data[dayType][currentLine][direction][train];
                      if (!Array.isArray(schedule) || !schedule.length) continue;
                      const record = records.get(train) || {
                        train,
                        directions: new Set(),
                        dayTypes: new Set(),
                        firstStation: schedule[0]?.[0] || '',
                        terminalStation: schedule[schedule.length - 1]?.[0] || '',
                        departureTime: schedule[0]?.[1] || '',
                        arrivalTime: schedule[schedule.length - 1]?.[1] || ''
                      };
                      record.directions.add(direction);
                      record.dayTypes.add(dayType);
                      records.set(train, record);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    const allRecords = Array.from(records.values()).sort((a, b) => a.train.localeCompare(b.train, 'zh-CN', { numeric: true }));

    function escapeHtml(value) {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function renderTrains() {
      const keyword = String(searchInput?.value || '').trim().toLowerCase();
      const filtered = keyword
        ? allRecords.filter((record) => [
            record.train,
            record.firstStation,
            record.terminalStation,
            ...record.directions
          ].some((value) => String(value).toLowerCase().includes(keyword)))
        : allRecords;
      const visible = filtered.slice(0, visibleLimit);

      trainsDiv.innerHTML = visible.map((record) => {
        const direction = Array.from(record.directions)[0] || '';
        const dayText = record.dayTypes.size > 1 ? '工作日 / 双休日' : Array.from(record.dayTypes)[0] || '';
        return `
          <button class="train-button train-service-card" type="button" onclick="showStationDetails('${escapeHtml(selectedLine)}', '${escapeHtml(record.train)}')">
            <span class="train-service-head">
              <strong>${escapeHtml(record.train)}</strong>
              <span>${escapeHtml(record.departureTime)}</span>
            </span>
            <span class="train-service-route">${escapeHtml(record.firstStation)} → ${escapeHtml(record.terminalStation)}</span>
            <small>${escapeHtml(direction)} · ${escapeHtml(dayText)}</small>
          </button>
        `;
      }).join('') || '<div class="empty-state compact-empty">没有匹配车次</div>';

      if (countElement) countElement.textContent = `显示 ${visible.length} / ${filtered.length} 个车次`;
      if (moreButton) moreButton.hidden = visible.length >= filtered.length;
    }

    searchInput?.addEventListener('input', () => {
      visibleLimit = 80;
      renderTrains();
    });
    moreButton?.addEventListener('click', () => {
      visibleLimit += 80;
      renderTrains();
    });
    renderTrains();
  })
  .catch(error => {
    console.error('Error:', error);
    const trainsDiv = document.getElementById('trains');
    if (trainsDiv) trainsDiv.innerHTML = '<div class="result-state is-error"><strong>车次数据加载失败</strong><span>请确认本地服务和时刻表文件可用。</span></div>';
  });

// 点击车次按钮后跳转到车次详细页面
function showStationDetails(line, train) {
    // 使用 URL 参数传递数据
    window.location.href = `train_details.html?line=${encodeURIComponent(line)}&train=${encodeURIComponent(train)}`;
}
