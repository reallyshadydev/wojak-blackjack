// Calls to the house server. Relative "/api" works in dev (Vite proxy) and in
// production (the server can serve the built app from the same origin).

async function call(path, { method = "GET", body } = {}) {
  const res = await fetch("/api" + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `request failed (${res.status})`);
  return data;
}

export const api = {
  config: () => call("/config"),
  house: () => call("/house"),
  state: (address) => call(`/state?address=${encodeURIComponent(address)}`),
  setClientSeed: (address, clientSeed) =>
    call("/fair/client-seed", { method: "POST", body: { address, clientSeed } }),
  startRound: (address, betSats) =>
    call("/round/start", { method: "POST", body: { address, betSats } }),
  action: (address, action) =>
    call("/round/action", { method: "POST", body: { address, action } }),
  deposit: (address, payload) =>
    call("/deposit", { method: "POST", body: { address, ...payload } }),
  withdraw: (address, amountSats) =>
    call("/withdraw", { method: "POST", body: { address, amountSats } }),
  wjkPrice: () => call("/price/wjk"),
};
