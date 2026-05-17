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

  function createEdgeKey(from, to, line, direction) {
    return `${from}-${to}-${line}-${direction}`;
  }

  function createEmptyGraph() {
    return {
      adjacencyList: {},
      edgeWeights: {},
      lineOfConnection: {},
      edges: [],
      stations: [],
      edgeKeySet: new Set(),
    };
  }

  function ensureStation(graph, stationName) {
    if (!graph.adjacencyList[stationName]) graph.adjacencyList[stationName] = [];
  }

  function shouldForceXizhimenJishuitan(line, from, to) {
    return (
      line === '2号线' &&
      (
        (from === '西直门' && to === '积水潭') ||
        (from === '积水潭' && to === '西直门')
      )
    );
  }

  function addRideEdge(graph, edge) {
    ensureStation(graph, edge.from);
    ensureStation(graph, edge.to);

    const key = createEdgeKey(edge.from, edge.to, edge.line, edge.direction);
    if (graph.edgeKeySet.has(key)) return;

    graph.edgeKeySet.add(key);

    const normalizedEdge = {
      from: edge.from,
      to: edge.to,
      station: edge.to,
      line: edge.line,
      direction: edge.direction,
      rawDirection: edge.rawDirection,
      travelTime: edge.travelMinutes,
      travelMinutes: edge.travelMinutes,
      type: 'ride',
    };

    graph.adjacencyList[edge.from].push(normalizedEdge);
    graph.edgeWeights[key] = edge.travelMinutes;
    graph.lineOfConnection[key] = edge.line;
    graph.edges.push(normalizedEdge);
  }

  function buildSubwayGraph(timetable, stationData, options = {}) {
    const graph = createEmptyGraph();
    const dayData = getDayData(timetable, options.dayType);
    const bidirectional = options.bidirectional !== false;

    if (!dayData || typeof dayData !== 'object') {
      console.warn('GraphBuilder: invalid timetable data');
      const stationNames = Object.keys(stationData || {});
      stationNames.forEach((stationName) => ensureStation(graph, stationName));
      graph.stations = stationNames;
      delete graph.edgeKeySet;
      return graph;
    }

    for (const line of Object.keys(dayData)) {
      const lineData = dayData[line] || {};
      for (const rawDirection of Object.keys(lineData)) {
        const trains = lineData[rawDirection] || {};
        const direction = `${line}-${rawDirection}`;

        for (const trainNo of Object.keys(trains)) {
          const schedule = trains[trainNo];
          if (!Array.isArray(schedule) || schedule.length < 2) continue;

          for (let i = 0; i < schedule.length - 1; i += 1) {
            const from = schedule[i][0];
            const to = schedule[i + 1][0];
            const t1 = timeStringToMinutes(schedule[i][1]);
            const t2 = timeStringToMinutes(schedule[i + 1][1]);
            let travelMinutes = Math.abs(t2 - t1);

            if (!Number.isFinite(travelMinutes) || travelMinutes <= 0) {
              travelMinutes = 2;
              console.warn(`GraphBuilder: invalid travel time ${from} -> ${to}, fallback to 2`);
            }

            if (shouldForceXizhimenJishuitan(line, from, to)) {
              travelMinutes = 3;
            }

            addRideEdge(graph, {
              from,
              to,
              line,
              direction,
              rawDirection,
              travelMinutes,
            });

            if (bidirectional) {
              addRideEdge(graph, {
                from: to,
                to: from,
                line,
                direction,
                rawDirection,
                travelMinutes,
              });
            }
          }
        }
      }
    }

    if (dayData['2号线']) {
      for (const rawDirection of Object.keys(dayData['2号线'] || {})) {
        const direction = `2号线-${rawDirection}`;
        addRideEdge(graph, {
          from: '西直门',
          to: '积水潭',
          line: '2号线',
          direction,
          rawDirection,
          travelMinutes: 3,
        });
        addRideEdge(graph, {
          from: '积水潭',
          to: '西直门',
          line: '2号线',
          direction,
          rawDirection,
          travelMinutes: 3,
        });
      }
    }

    graph.stations = Object.keys(graph.adjacencyList);
    delete graph.edgeKeySet;
    return graph;
  }

  root.GraphBuilder = {
    timeStringToMinutes,
    minutesToTimeString,
    getDayData,
    createEdgeKey,
    buildSubwayGraph,
  };
})();
