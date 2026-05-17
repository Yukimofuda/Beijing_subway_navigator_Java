(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;

  const FeasibilityStatus = {
    OK: 'OK',
    LOW_MARGIN: 'LOW_MARGIN',
    MISSED_LAST_TRAIN: 'MISSED_LAST_TRAIN',
    NO_TIMETABLE: 'NO_TIMETABLE',
  };

  function checkLastTrainRisk(route, timetableIndex, options = {}) {
    const warnings = [];
    const safetyMarginMinutes = Number(options.safetyMarginMinutes ?? 5);
    const service = root.TimetableService;
    if (!service || !timetableIndex) return warnings;

    for (const edge of route?.edges || []) {
      if (!Number.isFinite(edge.departMinute)) continue;

      const lastTrain = service.getLastTrain(
        timetableIndex,
        edge.from,
        {
          line: edge.line,
          directionKey: edge.direction,
        }
      );

      if (!lastTrain) {
        warnings.push({
          type: FeasibilityStatus.NO_TIMETABLE,
          station: edge.from,
          line: edge.line,
          message: `${edge.from} 缺少 ${edge.line} 末班车数据`,
        });
        continue;
      }

      if (edge.departMinute > lastTrain.minute) {
        warnings.push({
          type: FeasibilityStatus.MISSED_LAST_TRAIN,
          station: edge.from,
          line: edge.line,
          departMinute: edge.departMinute,
          lastTrainMinute: lastTrain.minute,
          message: `${edge.from} ${service.minutesToTimeString(edge.departMinute)} 已晚于 ${edge.line} 末班车 ${lastTrain.time}`,
        });
        continue;
      }

      const margin = lastTrain.minute - edge.departMinute;

      if (margin <= safetyMarginMinutes) {
        warnings.push({
          type: FeasibilityStatus.LOW_MARGIN,
          station: edge.from,
          line: edge.line,
          margin,
          lastTrainMinute: lastTrain.minute,
          message: `${edge.from} 乘坐 ${edge.line} 距末班车仅剩 ${margin} 分钟`,
        });
      }
    }

    return warnings;
  }

  function classifyRouteFeasibility(warnings) {
    if ((warnings || []).some((warning) => warning.type === FeasibilityStatus.MISSED_LAST_TRAIN)) {
      return '不可达';
    }
    if ((warnings || []).some((warning) => warning.type === FeasibilityStatus.LOW_MARGIN)) {
      return '末班车风险较高';
    }
    if ((warnings || []).some((warning) => warning.type === FeasibilityStatus.NO_TIMETABLE)) {
      return '时刻表不完整';
    }
    return '可达';
  }

  function buildFeasibilitySummary(route, timetableIndex, options = {}) {
    const warnings = checkLastTrainRisk(route, timetableIndex, options);
    return {
      status: classifyRouteFeasibility(warnings),
      warnings,
    };
  }

  root.RouteFeasibility = {
    FeasibilityStatus,
    checkLastTrainRisk,
    classifyRouteFeasibility,
    buildFeasibilitySummary,
  };
})();
