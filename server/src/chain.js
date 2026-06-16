// Minimal electrs (esplora-style) REST client for the WojakCoin chain.
// Same endpoints the wallet extension uses against https://api.wojakcoin.cash.

import { config } from "./config.js";

async function req(path, { method = "GET", body, headers } = {}) {
  const res = await fetch(config.apiUrl + path, { method, body, headers });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`electrs ${method} ${path} -> ${res.status}: ${text.slice(0, 200)}`);
  }
  return text;
}

async function reqJson(path, opts) {
  const text = await req(path, opts);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Unspent outputs for an address: [{ txid, vout, value, status }]. */
export function getUtxos(address) {
  return reqJson(`/address/${address}/utxo`);
}

/** Confirmed + mempool balance summary for an address (in sats). */
export async function getAddressBalance(address) {
  const utxos = await getUtxos(address).catch(() => []);
  const total = (Array.isArray(utxos) ? utxos : []).reduce((s, u) => s + u.value, 0);
  return total;
}

/** Raw transaction hex for a txid (needed as nonWitnessUtxo for legacy inputs). */
export function getTxHex(txid) {
  return req(`/tx/${txid}/hex`);
}

/** Decoded transaction JSON. */
export function getTx(txid) {
  return reqJson(`/tx/${txid}`);
}

/** Current chain tip height. */
export async function getTipHeight() {
  const t = await req(`/blocks/tip/height`);
  return Number(t);
}

/** Broadcast a raw transaction; returns the txid string. */
export async function broadcast(rawTxHex) {
  const txid = await req(`/tx`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: rawTxHex,
  });
  if (!/^[0-9a-fA-F]{64}$/.test(txid.trim())) {
    throw new Error(`broadcast rejected: ${txid.slice(0, 200)}`);
  }
  return txid.trim();
}
