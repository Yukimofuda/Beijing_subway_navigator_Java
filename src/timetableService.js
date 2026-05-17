(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;

  function timeStringToMinutes(timeStr) {
    if (!timeStr || !/^\d{2}:\d{2}$/.test(String(timeStr))) return NaN;
    const [hours, minutes] = String(timeStr).split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return NaN;
    return hours * 60 + minutes;
  }

  function minutesToTimeString(minutes) {
    if (!Number.isFinite(minutes)) return '--:--';
    const value = ((Math.round(minutes) % 1440) + 1440) % 1440;
    const h = String(Math.floor(value / 60)).padStart(2, '0');
    const m = String(value % 60).padStart(2, '0');
    return `${h}:${m}`;
  }

  function getDayData(timetable, dayType) {
    if (!timetable) return {};
    if (dayType && timetable[dayType]) return timetable[dayType];
    if (root.TransitData && root.TransitData.getDayData) {
      return root.TransitData.getDayData(timetable);
    }
    return timetable['工作日'] || timetable['双休日'] || timetable['周末'] || timetable;
  }

  function addToIndex(map, key, arrival) {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(arrival);
  }

  function sortIndex(index) {
    for (const map of Object.values(index)) {
      for (const list of map.values()) {
        list.sort((a, b) => {
          if (a.minute !== b.minute) return a.minute - b.minute;
          return String(a.trainNo).localeCompare(String(b.trainNo));
        });
      }
    }
  }

  function buildArrivalIndex(timetable, options = {}) {
    const dayData = getDayData(timetable, options.dayType);

    const index = {
      byStation: new Map(),
      byStationLine: new Map(),
      byStationLineDirection: new Map(),
      byLineDirection: new Map(),
    };

    for (const line of Object.keys(dayData || {})) {
      const lineData = dayData[line] || {};

      for (const direction of Object.keys(lineData)) {
        const trains = lineData[direction] || {};
        const directionKey = `${line}-${direction}`;

        for (const trainNo of Object.keys(trains)) {
          const schedule = trains[trainNo];
          if (!Array.isArray(schedule) || !schedule.length) continue;

          const firstStation = schedule[0][0];
          const terminalStation = schedule[schedule.length - 1][0];

          schedule.forEach(([station, time], stopIndex) => {
            const minute = timeStringToMinutes(time);
            if (!Number.isFinite(minute)) return;

            const arrival = {
              station,
              line,
              direction,
              directionKey,
              trainNo,
              minute,
              time,
              stopIndex,
              firstStation,
              terminalStation,
            };

            addToIndex(index.byStation, station, arrival);
            addToIndex(index.byStationLine, `${station}|${line}`, arrival);
            addToIndex(index.byStationLineDirection, `${station}|${line}|${directionKey}`, arrival);
            addToIndex(index.byLineDirection, `${line}|${directionKey}`, arrival);
          });
        }
      }
    }

    sortIndex(index);
    return index;
  }

  function lowerBound(list, target, getter) {
    let left = 0;
    let right = list.length;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (getter(list[mid]) < target) left = mid + 1;
      else right = mid;
    }

    return left;
  }

  function selectArrivalList(index, stationName, options = {}) {
    if (!index || !stationName) return [];
    const line = options.line;
    const directionKey = options.directionKey || options.direction;

    if (line && directionKey) {
      return index.byStationLineDirection.get(`${stationName}|${line}|${directionKey}`) || [];
    }
    if (line) {
      return index.byStationLine.get(`${stationName}|${line}`) || [];
    }
    return index.byStation.get(stationName) || [];
  }

  function getNextArrivals(index, stationName, currentMinute, options = {}) {
    const limit = Number(options.limit || 8);
    const list = selectArrivalList(index, stationName, options);
    const pos = lowerBound(list, currentMinute, (item) => item.minute);

    return list.slice(pos, pos + limit).map((item) => ({
      ...item,
      waitMinutes: item.minute - currentMinute,
    }));
  }

  function getEarliestDeparture(index, stationName, line, currentMinute, options = {}) {
    const directionKey = options.directionKey || options.direction;
    const next = getNextArrivals(index, stationName, currentMinute, {
      line,
      directionKey,
      limit: options.limit || 20,
    });

    return next[0] || null;
  }

  function getFirstTrain(index, stationName, options = {}) {
    const list = selectArrivalList(index, stationName, options);
    return list[0] || null;
  }

  function getLastTrain(index, stationName, options = {}) {
    const list = selectArrivalList(index, stationName, options);
    return list[list.length - 1] || null;
  }

  function getLineOperatingStatus(index, line, currentMinute, options = {}) {
    if (!index || !line) return { line, status: 'NO_TIMETABLE' };
    const active = [];
    for (const [key, list] of index.byLineDirection.entries()) {
      if (!key.startsWith(`${line}|`)) continue;
      const first = list[0];
      const last = list[list.length - 1];
      if (!first || !last) continue;
      active.push({
        directionKey: key.split('|')[1],
        first,
        last,
        isOperating: currentMinute >= first.minute && currentMinute <= last.minute,
      });
    }
    return {
      line,
      active,
      status: active.some((item) => item.isOperating) ? 'OPERATING' : 'CLOSED',
      options,
    };
  }

  root.TimetableService = {
    getDayData,
    timeStringToMinutes,
    minutesToTimeString,
    buildArrivalIndex,
    getNextArrivals,
    getFirstTrain,
    getLastTrain,
    getEarliestDeparture,
    getLineOperatingStatus,
    lowerBound,
  };
})();
