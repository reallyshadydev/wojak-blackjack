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

export const truncate = (addr, n = 5) =>
  addr ? `${addr.slice(0, n)}…${addr.slice(-4)}` : "";

export const shortHash = (h, n = 8) =>
  h ? `${h.slice(0, n)}…${h.slice(-6)}` : "";
