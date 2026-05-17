(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;

  const RoutePreference = {
    FASTEST: 'FASTEST',
    MIN_TRANSFER: 'MIN_TRANSFER',
  };

  function makeStateKey(station, line, direction, options = {}) {
    if (options.ignoreDirectionInState) {
      return `${station}|${line || 'NONE'}`;
    }
    return `${station}|${line || 'NONE'}|${direction || 'NONE'}`;
  }

  function transferPenalty(station, fromLine, toLine, fromDirection, toDirection, options) {
    const policy = root.TransferPolicy;
    if (!policy || !policy.getTransferPenaltyMinutes) {
      return fromLine && toLine && fromLine !== toLine ? Number(options.transferPenaltyMinutes || 5) : 0;
    }
    return policy.getTransferPenaltyMinutes(
      station,
      fromLine,
      toLine,
      options.transferRules,
      {
        fromDirection,
        toDirection,
        countDirectionChangeAsTransfer: false,
        defaultPenaltyMinutes: options.transferPenaltyMinutes || 5,
      }
    );
  }

  function normalizeEdge(current, edge) {
    const to = edge.to || edge.station;
    return {
      ...edge,
      from: edge.from || current.station,
      to,
      station: to,
      travelMinutes: Number(edge.travelMinutes ?? edge.travelTime ?? 2),
      travelTime: Number(edge.travelTime ?? edge.travelMinutes ?? 2),
    };
  }

  function pushState(queue, dist, state, options = {}) {
    const key = makeStateKey(state.station, state.line, state.direction, options);
    state.__key = key;
    dist.set(key, state.cost);
    queue.push(state);
    return key;
  }

  function reconstructRoute(previous, endState, meta = {}) {
    const edges = [];
    let cursorKey = endState.__key || makeStateKey(endState.station, endState.line, endState.direction, meta.options);

    while (previous.has(cursorKey)) {
      const step = previous.get(cursorKey);
      edges.unshift({
        ...step.edge,
        from: step.edge.from || step.prevState.station,
        to: step.edge.to || step.edge.station,
        station: step.edge.station || step.edge.to,
        transferPenaltyBefore: step.meta.transferPenalty,
        dwellMinutes: step.meta.dwellMinutes,
        rideMinutes: step.meta.rideMinutes,
      });
      cursorKey = step.prevKey;
    }

    const path = edges.length
      ? [edges[0].from, ...edges.map((edge) => edge.to || edge.station)]
      : [meta.start];

    return {
      path,
      edges,
      totalTime: endState.actualMinutes,
      totalMinutes: endState.actualMinutes,
      transfers: endState.transfers,
      lines: edges.map((edge) => edge.line),
      directions: edges.map((edge) => edge.direction),
      preference: meta.preference,
      start: meta.start,
      end: meta.end,
    };
  }

  function findFastestRoute(graph, start, end, options = {}) {
    const adjacencyList = graph?.adjacencyList || {};
    if (!adjacencyList[start] || !adjacencyList[end]) return null;

    const queue = [];
    const dist = new Map();
    const previous = new Map();

    const startState = {
      station: start,
      line: null,
      direction: null,
      cost: 0,
      actualMinutes: 0,
      transfers: 0,
    };

    pushState(queue, dist, startState, options);

    while (queue.length) {
      queue.sort((a, b) => a.cost - b.cost);
      const current = queue.shift();
      const currentKey = current.__key || makeStateKey(current.station, current.line, current.direction, options);

      if (current.cost > dist.get(currentKey)) continue;

      if (current.station === end) {
        return reconstructRoute(previous, current, {
          start,
          end,
          preference: RoutePreference.FASTEST,
          options,
        });
      }

      for (const rawEdge of adjacencyList[current.station] || []) {
        const edge = normalizeEdge(current, rawEdge);
        const penalty = transferPenalty(current.station, current.line, edge.line, current.direction, edge.direction, options);
        const didTransfer = penalty > 0;
        const dwellMinutes = current.station === start ? 0 : Number(options.dwellMinutes ?? 1);
        const rideMinutes = Number(edge.travelMinutes ?? edge.travelTime ?? 2);
        const stepCost = rideMinutes + penalty + dwellMinutes;
        const nextState = {
          station: edge.station || edge.to,
          line: edge.line,
          direction: edge.direction,
          cost: current.cost + stepCost,
          actualMinutes: current.actualMinutes + stepCost,
          transfers: current.transfers + (didTransfer ? 1 : 0),
        };
        const nextKey = makeStateKey(nextState.station, nextState.line, nextState.direction, options);

        if (!dist.has(nextKey) || nextState.cost < dist.get(nextKey)) {
          nextState.__key = nextKey;
          dist.set(nextKey, nextState.cost);
          previous.set(nextKey, {
            prevKey: currentKey,
            prevState: current,
            edge,
            meta: {
              transferPenalty: penalty,
              dwellMinutes,
              rideMinutes,
            },
          });
          queue.push(nextState);
        }
      }
    }

    return null;
  }

  function findMinTransferRoute(graph, start, end, options = {}) {
    const adjacencyList = graph?.adjacencyList || {};
    if (!adjacencyList[start] || !adjacencyList[end]) return null;

    const queue = [];
    const dist = new Map();
    const previous = new Map();

    const startState = {
      station: start,
      line: null,
      direction: null,
      cost: 0,
      actualMinutes: 0,
      transfers: 0,
    };

    pushState(queue, dist, startState, options);

    while (queue.length) {
      queue.sort((a, b) => a.cost - b.cost);
      const current = queue.shift();
      const currentKey = current.__key || makeStateKey(current.station, current.line, current.direction, options);

      if (current.cost > dist.get(currentKey)) continue;

      if (current.station === end) {
        return reconstructRoute(previous, current, {
          start,
          end,
          preference: RoutePreference.MIN_TRANSFER,
          options,
        });
      }

      for (const rawEdge of adjacencyList[current.station] || []) {
        const edge = normalizeEdge(current, rawEdge);
        const penalty = transferPenalty(current.station, current.line, edge.line, current.direction, edge.direction, options);
        const didTransfer = penalty > 0;
        const dwellMinutes = current.station === start ? 0 : Number(options.dwellMinutes ?? 1);
        const rideMinutes = Number(edge.travelMinutes ?? edge.travelTime ?? 2);
        const actualMinutes = current.actualMinutes + rideMinutes + penalty + dwellMinutes;
        const transfers = current.transfers + (didTransfer ? 1 : 0);
        const nextState = {
          station: edge.station || edge.to,
          line: edge.line,
          direction: edge.direction,
          cost: transfers * 10000 + actualMinutes,
          actualMinutes,
          transfers,
        };
        const nextKey = makeStateKey(nextState.station, nextState.line, nextState.direction, options);

        if (!dist.has(nextKey) || nextState.cost < dist.get(nextKey)) {
          nextState.__key = nextKey;
          dist.set(nextKey, nextState.cost);
          previous.set(nextKey, {
            prevKey: currentKey,
            prevState: current,
            edge,
            meta: {
              transferPenalty: penalty,
              dwellMinutes,
              rideMinutes,
            },
          });
          queue.push(nextState);
        }
      }
    }

    return null;
  }

  function findRoute(graph, start, end, options = {}) {
    const preference = options.preference || RoutePreference.FASTEST;

    if (preference === RoutePreference.MIN_TRANSFER || preference === '最少换乘') {
      return findMinTransferRoute(graph, start, end, options);
    }

    return findFastestRoute(graph, start, end, options);
  }

  root.RoutePlanner = {
    RoutePreference,
    findRoute,
    findFastestRoute,
    findMinTransferRoute,
    reconstructRoute,
    makeStateKey,
  };
})();
