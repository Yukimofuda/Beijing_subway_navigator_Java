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
    let trainsHTML = '';
    const trains = new Set();  // 用 Set 来确保车次不重复

    // 遍历 timetable.json 中的所有日期类型（如：工作日、周末等）
    for (const dayType in data) {
      if (data.hasOwnProperty(dayType)) {
        for (const currentLine in data[dayType]) {
          if (data[dayType].hasOwnProperty(currentLine)) {
            if (isSameLine(currentLine, selectedLine)) {  // 找到匹配的线路
              for (const direction in data[dayType][currentLine]) {
                if (data[dayType][currentLine].hasOwnProperty(direction)) {
                  for (const train in data[dayType][currentLine][direction]) {
                    if (data[dayType][currentLine][direction].hasOwnProperty(train)) {
                      trains.add(train); // 将车次添加到 Set 中，去重
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    // 遍历所有车次，生成按钮
    trains.forEach(train => {
      trainsHTML += `<button class="train-button" onclick="showStationDetails('${selectedLine}', '${train}')">${train}</button>`;
    });

    // 将生成的车次按钮插入到页面中
    trainsDiv.innerHTML = trainsHTML || '<div class="muted">未找到该线路车次</div>';
  })
  .catch(error => console.error('Error:', error));

// 点击车次按钮后跳转到车次详细页面
function showStationDetails(line, train) {
    // 使用 URL 参数传递数据
    window.location.href = `train_details.html?line=${encodeURIComponent(line)}&train=${encodeURIComponent(train)}`;
}
