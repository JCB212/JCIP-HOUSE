// Helper utilities
const { v4: uuidv4 } = require("uuid");

function nowUtc() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function genCode(n = 8) {
  const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < n; i++) s += alpha[Math.floor(Math.random() * alpha.length)];
  return s;
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

// ---- Month cycle helpers ----
function findLogicalMonth(isoDate, startDay) {
  const d = new Date(isoDate + "T00:00:00Z");
  const day = d.getUTCDate();
  const m = d.getUTCMonth() + 1;
  const y = d.getUTCFullYear();
  if (day >= Math.min(startDay, 28)) return { year: y, month_number: m };
  const prev = m - 1 || 12;
  return { year: m === 1 ? y - 1 : y, month_number: prev };
}

function monthRangeFor(year, monthNumber, startDay) {
  const sd = Math.min(startDay, 28);
  const start = `${year}-${String(monthNumber).padStart(2, "0")}-${String(sd).padStart(2, "0")}`;
  const endYear = monthNumber === 12 ? year + 1 : year;
  const endMonth = monthNumber === 12 ? 1 : monthNumber + 1;
  const end = `${endYear}-${String(endMonth).padStart(2, "0")}-${String(sd).padStart(2, "0")}`;
  return { start, end };
}

// ---- Debt optimizer ----
function optimizeDebts(balances, names, epsilon = 0.01) {
  const debtors = Object.entries(balances)
    .filter(([, b]) => b < -epsilon)
    .map(([id, b]) => [id, b])
    .sort((a, b) => a[1] - b[1]);
  const creditors = Object.entries(balances)
    .filter(([, b]) => b > epsilon)
    .map(([id, b]) => [id, b])
    .sort((a, b) => b[1] - a[1]);

  const transfers = [];
  let i = 0,
    j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amt = round2(Math.min(-debtors[i][1], creditors[j][1]));
    if (amt > epsilon) {
      transfers.push({
        from_user_id: debtors[i][0],
        from_name: names[debtors[i][0]] || "",
        to_user_id: creditors[j][0],
        to_name: names[creditors[j][0]] || "",
        amount: amt,
      });
    }
    debtors[i][1] += amt;
    creditors[j][1] -= amt;
    if (Math.abs(debtors[i][1]) < epsilon) i++;
    if (Math.abs(creditors[j][1]) < epsilon) j++;
  }
  return transfers;
}

module.exports = {
  uuidv4,
  nowUtc,
  today,
  genCode,
  round2,
  findLogicalMonth,
  monthRangeFor,
  optimizeDebts,
};
