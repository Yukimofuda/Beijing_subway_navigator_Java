(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;

  function groupEdgesByLine(edges) {
    const segments = [];
    let currentRide = null;
    let prevLine = null;

    for (const edge of edges || []) {
      const to = edge.to || edge.station;
      if (edge.transferPenaltyBefore > 0 && prevLine && prevLine !== edge.line) {
        if (currentRide) {
          segments.push(currentRide);
          currentRide = null;
        }

        segments.push({
          type: 'transfer',
          station: edge.from,
          fromLine: prevLine,
          toLine: edge.line,
          minutes: edge.transferPenaltyBefore,
        });
      }

      if (!currentRide || currentRide.line !== edge.line || currentRide.direction !== edge.direction) {
        if (currentRide) segments.push(currentRide);
        currentRide = {
          type: 'ride',
          line: edge.line,
          direction: edge.direction,
          from: edge.from,
          to,
          stops: [edge.from, to],
          rideMinutes: Number(edge.rideMinutes ?? edge.travelMinutes ?? edge.travelTime ?? 0),
          waitMinutes: Number(edge.waitMinutes || 0),
        };
      } else {
        currentRide.to = to;
        currentRide.stops.push(to);
        currentRide.rideMinutes += Number(edge.rideMinutes ?? edge.travelMinutes ?? edge.travelTime ?? 0);
        currentRide.waitMinutes += Number(edge.waitMinutes || 0);
      }

      prevLine = edge.line;
    }

    if (currentRide) segments.push(currentRide);
    return segments;
  }

  function extractTransfers(route) {
    return groupEdgesByLine(route?.edges || []).filter((segment) => segment.type === 'transfer');
  }

  function calculateRouteMetrics(route) {
    const edges = route?.edges || [];
    const rideMinutes = edges.reduce((sum, edge) => sum + Number(edge.rideMinutes ?? edge.travelMinutes ?? edge.travelTime ?? 0), 0);
    const transferMinutes = edges.reduce((sum, edge) => sum + Number(edge.transferPenaltyBefore || 0), 0);
    const waitMinutes = edges.reduce((sum, edge) => sum + Number(edge.waitMinutes || 0), 0);
    const dwellMinutes = edges.reduce((sum, edge) => sum + Number(edge.dwellMinutes || 0), 0);
    return {
      rideMinutes,
      transferMinutes,
      waitMinutes,
      dwellMinutes,
      totalMinutes: Number(route?.totalMinutes ?? route?.totalTime ?? rideMinutes + transferMinutes + waitMinutes + dwellMinutes),
      transferCount: Number(route?.transfers ?? extractTransfers(route).length),
    };
  }

  function buildRouteSummary(route) {
    const segments = groupEdgesByLine(route?.edges || []);
    const metrics = calculateRouteMetrics(route);
    const lines = Array.from(new Set((route?.edges || []).map((edge) => edge.line).filter(Boolean)));

    return {
      start: route?.start || route?.path?.[0],
      end: route?.end || route?.path?.[route.path.length - 1],
      path: route?.path || [],
      totalMinutes: metrics.totalMinutes,
      rideMinutes: metrics.rideMinutes,
      transferMinutes: metrics.transferMinutes,
      waitMinutes: metrics.waitMinutes,
      dwellMinutes: metrics.dwellMinutes,
      transferCount: metrics.transferCount,
      lines,
      segments,
    };
  }

  root.RouteSummary = {
    buildRouteSummary,
    groupEdgesByLine,
    extractTransfers,
    calculateRouteMetrics,
  };
})();
