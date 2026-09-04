(function () {
  const RECENT_KEY = 'subwayRecentStations';
  const quickActions = [
    { label: '规划路线', detail: '选择起终点与出行偏好', href: 'query.html', key: '路线 查询 起点 终点' },
    { label: '浏览线路图', detail: '缩放、定位并查看下一班车', href: 'Map.html', key: '地图 线路图 map' },
    { label: '运行看板', detail: '首末班与当前运营状态', href: 'service_board.html', key: '运行 首班 末班 下一班' },
    { label: '测算票价', detail: '查看距离、票价和推荐路径', href: 'fare_calculator.html', key: '票价 金额 距离' },
    { label: '站点导览', detail: '相邻站、线路与站内设施', href: 'station_guide.html', key: '站点 出口 设施 导览' },
    { label: '列车时刻', detail: '按线路、方向和车次查看', href: 'lines.html', key: '时刻表 车次 线路' },
  ];

  let root;
  let input;
  let results;
  let previousFocus;
  let stationData = null;
  let pinyinMap = {};
  let stationRecords = [];

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalize(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
  }

  function stationColor(line) {
    if (window.TransitData?.lineColor) return window.TransitData.lineColor(line);
    return '#1a73e8';
  }

  async function fetchJsonWithFallback(apiPath, staticPath) {
    try {
      const response = await fetch(apiPath);
      if (!response.ok) throw new Error(String(response.status));
      return await response.json();
    } catch (_) {
      const response = await fetch(staticPath);
      if (!response.ok) throw new Error(String(response.status));
      return response.json();
    }
  }

  async function loadStationData() {
    if (stationData) return;
    results.innerHTML = '<div class="command-loading"><span></span><span></span><span></span></div>';
    const stationLoader = window.TransitAPI?.loadStations
      ? window.TransitAPI.loadStations()
      : fetchJsonWithFallback('/api/stations', 'data/_station.json');
    const pinyinLoader = window.TransitAPI?.loadPinyin
      ? window.TransitAPI.loadPinyin()
      : fetchJsonWithFallback('/api/pinyin', 'data/station_pinyin.json').catch(() => ({}));
    [stationData, pinyinMap] = await Promise.all([stationLoader, pinyinLoader]);
    stationRecords = Object.keys(stationData || {}).map((name) => {
      const pinyin = pinyinMap[name] || {};
      const lines = window.TransitData?.stationLines
        ? window.TransitData.stationLines(stationData, name)
        : Array.from(new Set((stationData[name]?.lines || []).map(String)));
      return {
        name,
        lines,
        tokens: [name, pinyin.pinyin, pinyin.initials, ...lines].map(normalize).filter(Boolean),
      };
    });
  }

  function readRecentStations() {
    try {
      const recent = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      return Array.isArray(recent) ? recent.filter((name) => stationData?.[name]).slice(0, 6) : [];
    } catch (_) {
      return [];
    }
  }

  function saveRecentStation(name) {
    const next = [name, ...readRecentStations().filter((item) => item !== name)].slice(0, 8);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch (_) {}
  }

  function renderLineMarks(lines) {
    return lines.slice(0, 4).map((line) => (
      `<span class="command-line-mark" style="--command-line:${stationColor(line)}">${escapeHtml(line)}</span>`
    )).join('');
  }

  function renderHome() {
    const recent = readRecentStations();
    results.innerHTML = `
      <section class="command-section">
        <div class="command-section-label">立即前往</div>
        <div class="command-action-grid">
          ${quickActions.map((action) => `
            <a class="command-action" href="${action.href}">
              <strong>${action.label}</strong><span>${action.detail}</span>
            </a>
          `).join('')}
        </div>
      </section>
      ${recent.length ? `
        <section class="command-section">
          <div class="command-section-label">最近查看</div>
          <div class="command-recent-list">
            ${recent.map((name) => `<button type="button" data-command-station="${escapeHtml(name)}">${escapeHtml(name)}</button>`).join('')}
          </div>
        </section>
      ` : ''}
    `;
  }

  function stationScore(record, keyword) {
    const query = normalize(keyword);
    if (!query) return 0;
    if (normalize(record.name) === query) return 120;
    if (normalize(record.name).startsWith(query)) return 105;
    if (record.tokens.some((token) => token === query)) return 95;
    if (record.tokens.some((token) => token.startsWith(query))) return 80;
    if (record.tokens.some((token) => token.includes(query))) return 60;
    return 0;
  }

  function renderSearch(keyword) {
    const actionMatches = quickActions.filter((action) => normalize(`${action.label}${action.detail}${action.key}`).includes(normalize(keyword)));
    const stationMatches = stationRecords
      .map((record) => ({ record, score: stationScore(record, keyword) }))
      .filter((item) => item.score > 0)
      .sort((first, second) => second.score - first.score || first.record.name.localeCompare(second.record.name, 'zh-CN'))
      .slice(0, 12)
      .map((item) => item.record);

    if (!actionMatches.length && !stationMatches.length) {
      results.innerHTML = `
        <div class="command-empty">
          <strong>没有找到“${escapeHtml(keyword)}”</strong>
          <span>可输入完整站名、站名片段或拼音首字母。</span>
        </div>
      `;
      return;
    }

    results.innerHTML = `
      ${stationMatches.length ? `
        <section class="command-section">
          <div class="command-section-label">站点</div>
          <div class="command-station-list">
            ${stationMatches.map((station) => `
              <button class="command-station" type="button" data-command-station="${escapeHtml(station.name)}">
                <span><strong>${escapeHtml(station.name)}</strong><small>${escapeHtml(station.lines.join(' · ') || '站点')}</small></span>
                <span class="command-line-marks">${renderLineMarks(station.lines)}</span>
              </button>
            `).join('')}
          </div>
        </section>
      ` : ''}
      ${actionMatches.length ? `
        <section class="command-section">
          <div class="command-section-label">功能</div>
          <div class="command-action-grid compact">
            ${actionMatches.map((action) => `<a class="command-action" href="${action.href}"><strong>${action.label}</strong><span>${action.detail}</span></a>`).join('')}
          </div>
        </section>
      ` : ''}
    `;
  }

  function renderStationActions(name) {
    const station = stationData?.[name] || {};
    const lines = window.TransitData?.stationLines
      ? window.TransitData.stationLines(stationData, name)
      : (station.lines || []);
    saveRecentStation(name);
    results.innerHTML = `
      <section class="command-station-focus">
        <button class="command-back" type="button" data-command-back>返回搜索</button>
        <div class="command-station-focus-head">
          <div><span class="command-section-label">站点快捷操作</span><h2>${escapeHtml(name)}</h2></div>
          <div class="command-line-marks">${renderLineMarks(lines)}</div>
        </div>
        <p>${escapeHtml(lines.join(' · ') || '当前站点暂无线路标注')}</p>
        <div class="command-station-actions">
          <a class="btn btn-primary" href="station_guide.html?station=${encodeURIComponent(name)}">查看站点</a>
          <a class="btn" href="Map.html?station=${encodeURIComponent(name)}">地图定位</a>
          <a class="btn" href="query.html?start=${encodeURIComponent(name)}">设为出发站</a>
          <a class="btn" href="query.html?end=${encodeURIComponent(name)}">设为目的站</a>
        </div>
      </section>
    `;
  }

  async function openNavigator() {
    previousFocus = document.activeElement;
    root.hidden = false;
    document.body.classList.add('command-is-open');
    input.value = '';
    input.focus();
    try {
      await loadStationData();
      renderHome();
    } catch (error) {
      console.error(error);
      results.innerHTML = '<div class="command-empty"><strong>站点数据暂时无法读取</strong><span>其他页面仍可通过顶部导航打开。</span></div>';
    }
  }

  function closeNavigator() {
    root.hidden = true;
    document.body.classList.remove('command-is-open');
    previousFocus?.focus?.();
  }

  function createNavigator() {
    const header = document.querySelector('.topbar.app-header');
    if (!header || document.querySelector('[data-command-trigger]')) return;
    const actionHost = Array.from(header.children).find((child) => child.classList.contains('topbar-actions'));
    if (actionHost) {
      const trigger = document.createElement('button');
      trigger.className = 'quick-access-button';
      trigger.type = 'button';
      trigger.dataset.commandTrigger = 'true';
      trigger.innerHTML = '<span>全局查站</span><kbd>⌘ K</kbd>';
      actionHost.prepend(trigger);
    }

    const mobileTrigger = document.createElement('button');
    mobileTrigger.className = 'mobile-command-trigger';
    mobileTrigger.type = 'button';
    mobileTrigger.dataset.commandTrigger = 'true';
    mobileTrigger.setAttribute('aria-label', '打开全局查站');
    mobileTrigger.innerHTML = '<span aria-hidden="true"></span><strong>查站</strong>';
    document.body.appendChild(mobileTrigger);

    root = document.createElement('div');
    root.className = 'global-command';
    root.hidden = true;
    root.innerHTML = `
      <div class="global-command-backdrop" data-command-close></div>
      <section class="global-command-panel" role="dialog" aria-modal="true" aria-labelledby="global-command-title">
        <header class="global-command-head">
          <div class="command-search-mark" aria-hidden="true"></div>
          <label class="sr-only" id="global-command-title" for="global-command-input">搜索站点或功能</label>
          <input id="global-command-input" type="search" placeholder="搜索站点、线路或功能" autocomplete="off">
          <button type="button" data-command-close aria-label="关闭">关闭</button>
        </header>
        <div class="global-command-results"></div>
        <footer><span>输入站名片段或拼音首字母</span><span><kbd>Esc</kbd> 关闭</span></footer>
      </section>
    `;
    document.body.appendChild(root);
    input = root.querySelector('#global-command-input');
    results = root.querySelector('.global-command-results');

    document.querySelectorAll('[data-command-trigger]').forEach((trigger) => trigger.addEventListener('click', openNavigator));
    root.addEventListener('click', (event) => {
      if (event.target.closest('[data-command-close]')) closeNavigator();
      const stationButton = event.target.closest('[data-command-station]');
      if (stationButton) renderStationActions(stationButton.dataset.commandStation);
      if (event.target.closest('[data-command-back]')) {
        input.value = '';
        input.focus();
        renderHome();
      }
    });
    input.addEventListener('input', () => {
      const keyword = input.value.trim();
      if (!stationData) return;
      if (keyword) renderSearch(keyword);
      else renderHome();
    });
    root.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeNavigator();
    });
    document.addEventListener('keydown', (event) => {
      const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      const isSlash = event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !event.target.closest('input, textarea, select, [contenteditable]');
      if (!isShortcut && !isSlash) return;
      event.preventDefault();
      if (root.hidden) openNavigator();
      else closeNavigator();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', createNavigator);
  else createNavigator();
})();
