/**
 * Derives chart-ready aggregates and narrative bullets from normalized transaction rows.
 */

const BAD_STATUSES = new Set(["FAILED", "REJECTED", "REVERSAL", "ERROR", "TIMEOUT", "DENIED", "DECLINED"]);

function mergeSmallSlices(items, maxSlices = 8, otherLabel = "Other") {
  if (!items?.length) return [];
  const sorted = [...items].sort((a, b) => (b.value || 0) - (a.value || 0));
  if (sorted.length <= maxSlices) return sorted;
  const head = sorted.slice(0, maxSlices - 1);
  const rest = sorted.slice(maxSlices - 1);
  const otherSum = rest.reduce((s, x) => s + (x.value || 0), 0);
  return [...head, { name: otherLabel, value: otherSum }];
}

export function computeTransactionInsights(rows) {
  if (!rows?.length) return null;

  const typeCount = {};
  const statusCount = {};
  const volumeByType = {};
  let totalVolume = 0;
  const amounts = [];
  let anomalyCount = 0;
  const flaggedSamples = [];

  for (const tx of rows) {
    const amt = Number(tx.amount);
    const safeAmt = Number.isFinite(amt) ? amt : 0;
    totalVolume += safeAmt;
    if (safeAmt > 0) amounts.push(safeAmt);
  }

  const meanAmt = rows.length ? totalVolume / rows.length : 0;

  for (const tx of rows) {
    const t = String(tx.type || "UNKNOWN").trim() || "UNKNOWN";
    const s = String(tx.status || "SUCCESS").trim().toUpperCase() || "SUCCESS";
    const amt = Number(tx.amount);
    const safeAmt = Number.isFinite(amt) ? amt : 0;

    typeCount[t] = (typeCount[t] || 0) + 1;
    statusCount[s] = (statusCount[s] || 0) + 1;
    volumeByType[t] = (volumeByType[t] || 0) + safeAmt;

    const isAnomaly =
      BAD_STATUSES.has(s) ||
      t === "UNKNOWN" ||
      (meanAmt > 0 && safeAmt > 0 && safeAmt > meanAmt * 40);

    if (isAnomaly) {
      anomalyCount += 1;
      if (flaggedSamples.length < 20) {
        const snippet = typeof tx.raw === "string" ? tx.raw.slice(0, 200) : JSON.stringify(tx.raw || {}).slice(0, 200);
        flaggedSamples.push({ type: t, status: s, amount: safeAmt, snippet });
      }
    }
  }

  const typeData = mergeSmallSlices(
    Object.entries(typeCount).map(([name, value]) => ({ name, value })),
    8,
    "Other types"
  );
  const statusData = mergeSmallSlices(
    Object.entries(statusCount).map(([name, value]) => ({ name, value })),
    8,
    "Other statuses"
  );
  const volumeByTypeData = mergeSmallSlices(
    Object.entries(volumeByType).map(([name, value]) => ({
      name,
      value: Math.round(value * 100) / 100,
    })),
    8,
    "Other (volume)"
  ).filter((x) => x.value > 0);

  const sortedAmt = [...amounts].sort((a, b) => a - b);
  const mid = Math.floor(sortedAmt.length / 2);
  const medianAmount =
    sortedAmt.length === 0
      ? 0
      : sortedAmt.length % 2 === 1
        ? sortedAmt[mid]
        : (sortedAmt[mid - 1] + sortedAmt[mid]) / 2;
  const p95 =
    sortedAmt.length === 0
      ? 0
      : sortedAmt[Math.min(sortedAmt.length - 1, Math.floor(sortedAmt.length * 0.95))];

  const bucketDefs = [
    { name: "$0", test: (a) => a === 0 },
    { name: "$0.01–20", test: (a) => a > 0 && a <= 20 },
    { name: "$20–50", test: (a) => a > 20 && a <= 50 },
    { name: "$50–100", test: (a) => a > 50 && a <= 100 },
    { name: "$100–500", test: (a) => a > 100 && a <= 500 },
    { name: "$500+", test: (a) => a > 500 },
  ];
  const amountBuckets = bucketDefs.map((b) => ({
    name: b.name,
    value: amounts.filter(b.test).length,
  }));

  const topType = typeData[0];
  const topStatus = statusData[0];
  const failRate =
    rows.length > 0
      ? ((statusCount.FAILED || 0) + (statusCount.REJECTED || 0) + (statusCount.ERROR || 0) + (statusCount.TIMEOUT || 0)) /
        rows.length
      : 0;

  const deepBullets = [
    `${rows.length.toLocaleString()} rows ingested; total volume $${totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
    topType
      ? `Dominant transaction label: ${topType.name} (${topType.value.toLocaleString()} events, ${((topType.value / rows.length) * 100).toFixed(1)}%).`
      : "No type breakdown available.",
    topStatus
      ? `Most common status: ${topStatus.name} (${topStatus.value.toLocaleString()} occurrences).`
      : null,
    `Median amount $${medianAmount.toFixed(2)} · 95th percentile $${p95.toFixed(2)}.`,
    failRate > 0
      ? `Failure / reject / error share ≈ ${(failRate * 100).toFixed(2)}% of rows — review flagged samples below if non-trivial.`
      : "No FAILED/REJECTED/ERROR statuses detected in parsed status fields.",
    volumeByTypeData[0]
      ? `Highest gross volume by type: ${volumeByTypeData[0].name} ($${volumeByTypeData[0].value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).`
      : null,
  ].filter(Boolean);

  return {
    totalTx: rows.length,
    totalValue: totalVolume,
    anomalies: anomalyCount,
    medianAmount,
    p95Amount: p95,
    typeData,
    statusData,
    volumeByTypeData,
    amountBuckets,
    deepBullets,
    flaggedSamples,
  };
}
