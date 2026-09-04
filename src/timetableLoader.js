(function () {
  const PART_PATHS = ['data/timetable.workday.json', 'data/timetable.weekend.json'];

  async function fetchJson(path) {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`HTTP error! ${response.status} when fetching ${path}`);
    }
    return response.json();
  }

  async function loadTimetableData() {
    if (window.TransitAPI?.loadTimetable) {
      return window.TransitAPI.loadTimetable();
    }
    try {
      const parts = await Promise.all(PART_PATHS.map(fetchJson));
      const merged = Object.assign({}, ...parts);
      if (!merged || typeof merged !== 'object' || !Object.keys(merged).length) {
        throw new Error('Merged timetable parts are empty');
      }
      return merged;
    } catch (err) {
      try {
        const response = await fetch('data/timetable.json');
        if (!response.ok) throw err;
        const fallback = await response.json();
        return fallback;
      } catch (fallbackErr) {
        const protocol = window.location.protocol;
        const extra =
          protocol === 'file:'
            ? ' Please open via http://localhost:3000 (run: node src/Node.js).'
            : '';
        throw new Error(`Failed to load timetable parts.${extra}`);
      }
    }
  }

  window.loadTimetableData = loadTimetableData;
})();
