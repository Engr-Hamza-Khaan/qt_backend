// In-memory aggregation helpers. The old Sequelize/Postgres code used GROUP BY / SUM / date_trunc;
// Redis has no SQL engine, so the same result shapes are produced here in JavaScript.
// Numeric results are returned as strings (like Postgres NUMERIC / BIGINT) so API responses keep
// exactly the same format the frontend already consumes.

const fixed2 = (n) => Number(n).toFixed(2);

// Best sellers: group order items by variation and rank by sold quantity.
//   items must be loaded with { variation: { product } } included.
//   valueKey/valueOf describe the second aggregate (e.g. totalSales = qty * price).
const bestSellersByVariation = (items, { valueKey, valueOf, limit = 5 }) => {
  const groups = new Map();
  for (const item of items) {
    const key = item.variationId;
    if (!groups.has(key)) {
      groups.set(key, { variationId: key, qty: 0, value: null, variation: item.variation });
    }
    const g = groups.get(key);
    g.qty += Number(item.quantity) || 0;
    const v = valueOf(item);
    if (v !== null && v !== undefined && !Number.isNaN(v)) g.value = (g.value || 0) + v;
  }
  return [...groups.values()]
    .sort((a, b) => b.qty - a.qty)
    .slice(0, limit)
    .map((g) => ({
      variationId: g.variationId,
      soldQuantity: String(g.qty),
      [valueKey]: g.value === null ? null : fixed2(g.value),
      variation: g.variation,
    }));
};

// Daily totals (date_trunc('day', ...) + SUM + COUNT), oldest day first.
const dailyTotals = (rows, { dateOf, amountOf, amountKey, countKey }) => {
  const days = new Map();
  for (const row of rows) {
    const d = new Date(dateOf(row));
    const key = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    if (!days.has(key)) days.set(key, { amount: 0, count: 0 });
    const g = days.get(key);
    g.amount += Number(amountOf(row)) || 0;
    g.count += 1;
  }
  return [...days.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([key, g]) => {
      const out = { date: new Date(key), [amountKey]: fixed2(g.amount) };
      if (countKey) out[countKey] = String(g.count);
      return out;
    });
};

module.exports = { bestSellersByVariation, dailyTotals, fixed2 };
