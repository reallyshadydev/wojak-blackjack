// Minimal electrs (esplora-style) REST client for the WojakCoin chain.
// Same endpoints the wallet extension uses against https://api.wojakcoin.cash.

import { config } from "./config.js";

// 0.001 WJK outputs carry inscriptions; never spend them as funding (matches
// wojak-wallet-extension). Fallback guard when the ord index briefly lags.
export const CARRIER_SATS = 100_000;

async function req(path, { method = "GET", body, headers, baseUrl = config.apiUrl } = {}) {
  const res = await fetch(baseUrl + path, { method, body, headers });
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

async function ordJson(path) {
  try {
    const res = await fetch(config.ordUrl + path, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Unspent outputs for an address: [{ txid, vout, value, status }]. */
export function getUtxos(address) {
  return reqJson(`/address/${address}/utxo`);
}

/**
 * Outpoints ("txid:vout") that currently hold an inscription, per the ord index.
 * Authoritative list of outputs that must NOT be spent as plain funds.
 */
export async function getProtectedOutpoints(address) {
  const res = await ordJson(`/address/${address}`);
  return new Set(res?.outputs ?? []);
}

/**
 * UTXOs safe to spend: excludes inscription-bearing outputs (ord) and 0.001 WJK
 * carrier outputs, matching wojak-wallet-extension getSpendableUtxos().
 */
export async function getSpendableUtxos(address) {
  const all = await getUtxos(address);
  if (!Array.isArray(all)) return [];

  const protectedOutpoints = await getProtectedOutpoints(address);
  return all.filter(
    (u) =>
      !protectedOutpoints.has(`${u.txid}:${u.vout}`) &&
      u.value !== CARRIER_SATS
  );
}

/** Confirmed + mempool spendable balance (excludes inscription UTXOs). */
export async function getAddressBalance(address) {
  const utxos = await getSpendableUtxos(address).catch(() => []);
  return utxos.reduce((s, u) => s + u.value, 0);
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
