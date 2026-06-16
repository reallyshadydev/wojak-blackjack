// Tiny JSON-file persistence for player balances, seeds and round history.
// Single-process, synchronous reads with a debounced write — plenty for a
// game server and trivial to inspect/audit.

import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

let state = { players: {}, chain: { txs: {} } };
let writeTimer = null;

function load() {
  try {
    if (fs.existsSync(config.stateFile)) {
      state = JSON.parse(fs.readFileSync(config.stateFile, "utf8"));
      state.players ||= {};
      state.chain ||= { txs: {} };
    }
  } catch (e) {
    console.error("[store] failed to load state, starting fresh:", e.message);
    state = { players: {}, chain: { txs: {} } };
  }
}
load();

export function save() {
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    try {
      fs.mkdirSync(path.dirname(config.stateFile), { recursive: true });
      fs.writeFileSync(config.stateFile, JSON.stringify(state, null, 2));
    } catch (e) {
      console.error("[store] write failed:", e.message);
    }
  }, 150);
}

export function getPlayer(address) {
  // Scope ledgers by mode so DEMO free-play balances can NEVER appear as real
  // funds in live mode (and vice-versa). Real deposits live under the plain
  // address key; demo play lives under "demo:<address>".
  const key = config.demoMode ? `demo:${address}` : address;
  let p = state.players[key];
  if (!p) {
    p = {
      address,
      balanceSats: 0,
      clientSeed: "",
      roundCounter: 0,
      welcomeGranted: false,
      epoch: null, // provably-fair hash-chain epoch (secret terminal redacted from API)
      activeRound: null,
      history: [],
      deposits: [],
      withdrawals: [],
    };
    state.players[key] = p;
  }
  return p;
}

/** Record a simulated on-chain tx in DEMO mode, served back like an electrs tx. */
export function putDemoTx(txid, tx) {
  state.chain.txs[txid] = tx;
  save();
}

/** Look up a simulated DEMO-mode tx by id. */
export function getDemoTx(txid) {
  return state.chain.txs[txid] ?? null;
}

export function pushHistory(player, entry) {
  player.history.unshift(entry);
  if (player.history.length > 50) player.history.length = 50;
}

export function allState() {
  return state;
}
