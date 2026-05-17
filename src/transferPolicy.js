(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;

  const DEFAULT_TRANSFER_MINUTES = 5;

  function simplifyLineName(lineName) {
    if (root.TransitData && root.TransitData.simplifyLineName) {
      return root.TransitData.simplifyLineName(lineName);
    }

    return String(lineName || '')
      .replace(/^地铁/, '')
      .replace(/\(.+\)$/, '')
      .replace(/(内环|外环)$/, '')
      .trim();
  }

  function normalizeLineName(lineName) {
    return simplifyLineName(lineName);
  }

  function isTransfer(fromLine, toLine, fromDirection, toDirection, options = {}) {
    if (!fromLine || !toLine) return false;

    const normalizedFrom = normalizeLineName(fromLine);
    const normalizedTo = normalizeLineName(toLine);

    if (normalizedFrom !== normalizedTo) return true;

    if (options.countDirectionChangeAsTransfer) {
      return Boolean(fromDirection && toDirection && fromDirection !== toDirection);
    }

    return false;
  }

  function getTransferPenaltyMinutes(stationName, fromLine, toLine, rules = {}, options = {}) {
    if (!isTransfer(fromLine, toLine, options.fromDirection, options.toDirection, options)) {
      return 0;
    }

    const defaultPenalty =
      Number(rules.defaultPenaltyMinutes) ||
      Number(options.defaultPenaltyMinutes) ||
      DEFAULT_TRANSFER_MINUTES;

    const stationRule = rules.stations?.[stationName] || rules[stationName];

    if (!stationRule) return defaultPenalty;

    const pairKey = `${normalizeLineName(fromLine)}->${normalizeLineName(toLine)}`;

    return (
      Number(stationRule.pairs?.[pairKey]) ||
      Number(stationRule.defaultPenaltyMinutes) ||
      defaultPenalty
    );
  }

  root.TransferPolicy = {
    DEFAULT_TRANSFER_MINUTES,
    simplifyLineName,
    normalizeLineName,
    isTransfer,
    getTransferPenaltyMinutes,
  };
})();
