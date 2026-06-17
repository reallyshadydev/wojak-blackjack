// Provably-fair deck derivation, anchored on-chain via a server-seed HASH CHAIN.
//
// The house picks a secret 32-byte `terminal` seed and folds it forward with
// SHA-256 `length` times: node(k) = SHA256^k(terminal). The final value,
// node(length) = ANCHOR, is published ON-CHAIN (an OP_RETURN output) before any
// hand is played. That single on-chain value commits the ENTIRE sequence of
// per-hand seeds in advance — the house cannot change any of them afterwards
// without breaking the hash chain that leads back to the on-chain anchor.
//
// Hand `nonce` (0-based, within the epoch) uses a FRESH 32-byte server seed:
//     serverSeed(nonce) = node(length-1-nonce)
// revealed the instant the hand ends. Because
//     SHA256(serverSeed(nonce)) = node(length-nonce)
// equals the ANCHOR (for nonce 0) or the PREVIOUS hand's revealed seed, every
// reveal hashes forward to the on-chain anchor — so the player verifies against
// the blockchain, not the server. The deck itself is a pure function of
// (serverSeed, clientSeed, nonce); the player picks the client seed, so neither
// side can grind a favourable shuffle. All reproducible with only ./sha256.js.

import { hmacSha256, sha256, fromHex, toHex, utf8 } from "./sha256.js";

export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K"];
export const SUITS = ["S", "H", "D", "C"]; // Spades, Hearts, Diamonds, Clubs

/** Canonical (unshuffled) shoe of `decks` × 52 cards, e.g. "AS","2S",... */
export function orderedDeck(decks = 1) {
  const deck = [];
  for (let d = 0; d < Math.max(1, decks | 0); d++)
    for (const s of SUITS) for (const r of RANKS) deck.push(r + s);
  return deck;
}

/** SHA-256 commitment / one hash-chain link of a hex server seed. */
export function commitment(serverSeedHex) {
  return toHex(sha256(fromHex(serverSeedHex)));
}

/** Fold a hex seed forward `times` SHA-256 iterations: SHA256^times(seed). */
export function foldForward(seedHex, times) {
  let cur = seedHex;
  for (let i = 0; i < times; i++) cur = commitment(cur);
  return cur;
}

/**
 * The on-chain anchor for an epoch: node(length) = SHA256^length(terminal).
 * This is the single value published on-chain that commits every per-hand seed.
 */
export function chainAnchor(terminalHex, length) {
  return foldForward(terminalHex, length);
}

/**
 * The fresh server seed for hand `nonce` (0-based) in an epoch of `length`:
 *   serverSeed(nonce) = node(length-1-nonce) = SHA256^(length-1-nonce)(terminal)
 * Revealed only after the hand ends.
 */
export function seedAtNonce(terminalHex, length, nonce) {
  return foldForward(terminalHex, length - 1 - nonce);
}

/**
 * Verify a revealed seed against the ON-CHAIN anchor — the core trustless check.
 * SHA256^(nonce+1)(serverSeed) must equal node(length) = anchor. Needs nothing
 * but the seed, its nonce, and the anchor read from the blockchain.
 */
export function linksToAnchor(serverSeedHex, nonce, anchorHex) {
  return foldForward(serverSeedHex, nonce + 1) === String(anchorHex).toLowerCase();
}

/**
 * Generates an endless stream of bytes from HMAC-SHA256(serverSeed, msg) where
 * msg = `${clientSeed}:${nonce}:${round}` and `round` increments every 32 bytes.
 * This is the de-facto standard "Stake" construction.
 */
function* byteStream(serverSeedHex, clientSeed, nonce) {
  const key = fromHex(serverSeedHex);
  let round = 0;
  while (true) {
    const block = hmacSha256(key, utf8(`${clientSeed}:${nonce}:${round}`));
    for (let i = 0; i < block.length; i++) yield block[i];
    round++;
  }
}

/**
 * Generates floats in [0,1) by consuming 4 bytes each, big-endian fractional:
 * f = b0/256 + b1/256^2 + b2/256^3 + b3/256^4.
 */
function* floatStream(serverSeedHex, clientSeed, nonce) {
  const bytes = byteStream(serverSeedHex, clientSeed, nonce);
  while (true) {
    let f = 0;
    let div = 256;
    for (let i = 0; i < 4; i++) {
      f += bytes.next().value / div;
      div *= 256;
    }
    yield f;
  }
}

/**
 * Deterministically shuffle the shoe (`decks` × 52 cards) for a round.
 * @returns {string[]} the shuffled deck (index 0 is the first card dealt).
 */
export function deriveDeck(serverSeedHex, clientSeed, nonce, decks = 1) {
  const deck = orderedDeck(decks);
  const floats = floatStream(serverSeedHex, clientSeed, String(nonce));
  // Fisher–Yates from the top down.
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(floats.next().value * (i + 1));
    const t = deck[i];
    deck[i] = deck[j];
    deck[j] = t;
  }
  return deck;
}
