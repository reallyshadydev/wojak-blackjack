// In-browser provably-fair verification, rooted in the BLOCKCHAIN.
//
// It reads the epoch's anchor transaction straight from the chain, decodes the
// OP_RETURN anchor, and confirms the revealed seed hashes forward to that
// on-chain value — using the EXACT shared code the house ran. The player trusts
// the chain + math, not the operator.

import { linksToAnchor, commitment, deriveDeck } from "@shared/provably-fair.js";
import { findAnchorInTx } from "@shared/onchain.js";

/** Read the anchor tx from the public chain first, then the same-origin relay. */
async function fetchAnchorTx(txid, chain) {
  const urls = [];
  if (chain?.electrsTxBase) urls.push(`${chain.electrsTxBase}/${txid}`); // direct chain read
  if (chain?.chainProxyBase) urls.push(`${chain.chainProxyBase}/${txid}`); // relay / demo chain
  let lastErr;
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
      lastErr = new Error(`${res.status}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`could not read the anchor transaction from the chain (${lastErr?.message ?? "no source"})`);
}

/**
 * Verify a finished hand. `fair` carries { serverSeed, commitment, clientSeed,
 * nonce, anchor, anchorTxid, deck }. `chain` carries the tx read bases.
 * @returns { commitmentOk, deckOk, anchorReadOk, linkOk, onChainAnchor, deck, error }
 */
export async function verifyRoundOnChain(fair, chain) {
  // Offline checks (no chain needed): commitment + deck reproduction.
  const computedCommitment = commitment(fair.serverSeed);
  const commitmentOk = computedCommitment === fair.commitment;
  const deck = deriveDeck(fair.serverSeed, fair.clientSeed, fair.nonce);
  const deckOk = fair.deck ? JSON.stringify(deck) === JSON.stringify(fair.deck) : null;

  // Chain-rooted checks: read the on-chain anchor and confirm the seed links to it.
  let onChainAnchor = null;
  let anchorReadOk = false;
  let linkOk = false;
  let error = null;
  try {
    const tx = await fetchAnchorTx(fair.anchorTxid, chain);
    onChainAnchor = findAnchorInTx(tx)?.anchorHex ?? null;
    anchorReadOk = !!onChainAnchor && onChainAnchor === String(fair.anchor).toLowerCase();
    linkOk = !!onChainAnchor && linksToAnchor(fair.serverSeed, fair.nonce, onChainAnchor);
  } catch (e) {
    error = e.message;
  }

  return { commitmentOk, deckOk, deck, computedCommitment, onChainAnchor, anchorReadOk, linkOk, error };
}
