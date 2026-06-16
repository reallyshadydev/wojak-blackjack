// Provably-fair epoch manager — a server-seed HASH CHAIN anchored on-chain.
//
// The house picks a secret 32-byte `terminal` and folds it forward `length`
// times; the final value (the anchor) is published on-chain ONCE per epoch and
// commits every per-hand seed in advance. Hand `nonce` uses a fresh seed
// node(length-1-nonce), revealed at settle and verifiable straight back to the
// on-chain anchor. The secret `terminal` never leaves this server until each
// seed is naturally revealed by play. Nothing to trust but the chain + the
// shared ../../shared/provably-fair.js.

import { randomBytes } from "node:crypto";
import { chainAnchor, seedAtNonce, commitment } from "../../shared/provably-fair.js";
import { toHex } from "../../shared/sha256.js";
import { config } from "./config.js";
import { publishAnchor } from "./anchor.js";

let epochSeq = 0;
const nextEpochId = () => `e${Date.now().toString(36)}${(epochSeq++).toString(36)}`;

export function randomClientSeed() {
  return toHex(randomBytes(8));
}

/** Public, seed-safe view of an epoch (NEVER includes the secret terminal). */
export function publicEpoch(epoch) {
  if (!epoch) return null;
  return {
    id: epoch.id,
    anchor: epoch.anchor,
    anchorTxid: epoch.anchorTxid,
    length: epoch.length,
    used: epoch.used,
    remaining: epoch.length - epoch.used,
    demo: epoch.demo,
    createdAt: epoch.createdAt,
  };
}

/**
 * Ensure the player has a usable epoch, creating + anchoring a new one on-chain
 * when there is none or the current one is exhausted. Async because publishing
 * the anchor may broadcast a transaction in live mode.
 */
export async function ensureEpoch(player) {
  const cur = player.epoch;
  if (cur && cur.used < cur.length) return cur;

  const terminal = toHex(randomBytes(32));
  const length = config.epochLength;
  const anchor = chainAnchor(terminal, length);

  const published = await publishAnchor({ anchorHex: anchor, length });

  player.epoch = {
    id: nextEpochId(),
    terminal, // secret — redacted from every API response
    anchor,
    length,
    used: 0,
    anchorTxid: published.txid,
    demo: published.demo,
    createdAt: new Date().toISOString(),
  };
  return player.epoch;
}

/**
 * Claim the next seed in the epoch. Returns { nonce, serverSeed, commitment }
 * and advances the epoch cursor. `commitment` is the prior hash-chain link
 * (the on-chain anchor for nonce 0, else the previous hand's seed) — already
 * known before the deal, so the hand is committed in advance.
 */
export function claimSeed(epoch) {
  const nonce = epoch.used;
  const serverSeed = seedAtNonce(epoch.terminal, epoch.length, nonce);
  epoch.used += 1;
  return { nonce, serverSeed, commitment: commitment(serverSeed) };
}
