export const SATS = 100_000_000;

export const toWJK = (sats) => (sats ?? 0) / SATS;
export const toSats = (wjk) => Math.round(Number(wjk) * SATS);

/** Format sats as a WJK string, trimming trailing zeros sensibly. */
export function fmtWJK(sats, maxFrac = 4) {
  const v = toWJK(sats);
  const s = v.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFrac,
  });
  return s;
}

/** USD equivalent for a WJK satoshi amount at the given USDT-per-WJK spot. */
export function fmtUsd(sats, usdtPerWjk) {
  if (!usdtPerWjk || !Number.isFinite(usdtPerWjk)) return null;
  const usd = toWJK(sats) * usdtPerWjk;
  if (!Number.isFinite(usd)) return null;
  if (Math.abs(usd) >= 1000) {
    return usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (Math.abs(usd) >= 1) return usd.toFixed(2);
  if (Math.abs(usd) >= 0.01) return usd.toFixed(2);
  return usd.toFixed(4);
}

/** USD for a WJK float (deposit modal input). */
export function fmtUsdFromWjk(wjk, usdtPerWjk) {
  if (!usdtPerWjk || !Number.isFinite(usdtPerWjk) || !Number.isFinite(wjk)) return null;
  return fmtUsd(Math.round(wjk * SATS), usdtPerWjk);
}

export const truncate = (addr, n = 5) =>
  addr ? `${addr.slice(0, n)}…${addr.slice(-4)}` : "";

export const shortHash = (h, n = 8) =>
  h ? `${h.slice(0, n)}…${h.slice(-6)}` : "";

/** Net P/L on the insurance side bet alone. */
export function insuranceNet(insurance) {
  if (!insurance?.taken) return 0;
  return (insurance.return ?? 0) - insurance.stake;
}

/** Human-readable settle line when insurance was in play. */
export function formatInsuranceBreakdown(round) {
  const ins = round?.insurance;
  if (!ins?.taken) return null;
  const insNet = insuranceNet(ins);
  const handNet = (round?.net ?? 0) - insNet;
  const handPart =
    handNet > 0 ? `Hand +${fmtWJK(handNet)}` : handNet < 0 ? `Hand ${fmtWJK(handNet)}` : "Hand push";
  const insPart =
    insNet > 0
      ? `Insurance +${fmtWJK(insNet)}`
      : insNet < 0
      ? `Insurance ${fmtWJK(insNet)}`
      : "Insurance push";
  return `${handPart} · ${insPart}`;
}
