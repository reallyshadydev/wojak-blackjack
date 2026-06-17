// Round orchestration: ties the on-chain-anchored provably-fair hash chain, the
// shared blackjack engine, and the player's bankroll together. The server is
// authoritative — it owns the secret epoch terminal and only reveals each hand's
// seed once that hand is finished. Every revealed seed is verifiable straight
// back to the epoch anchor that was written on-chain before any hand was dealt.

import { config } from "./config.js";
import { deriveDeck } from "../../shared/provably-fair.js";
import { playRound } from "../../shared/blackjack.js";
import { ensureEpoch, claimSeed, randomClientSeed } from "./fair.js";
import { pushHistory, save } from "./store.js";

let roundSeq = 0;
const nextId = () => `r${Date.now().toString(36)}${(roundSeq++).toString(36)}`;

function deckFor(round) {
  return deriveDeck(round.serverSeed, round.clientSeed, round.nonce);
}

/** Legal actions filtered by what the player's bankroll can actually afford. */
function affordable(awaiting, legal, betSats, balanceSats) {
  if (awaiting?.phase === "insurance") {
    const half = Math.floor(betSats / 2);
    return legal.filter((a) => (a === "insurance" ? balanceSats >= half : true));
  }
  const canStake = balanceSats >= betSats;
  return legal.filter((a) => (a === "double" || a === "split" ? canStake : true));
}

/** Public, redacted view of a round — never leaks the seed/deck until finished. */
export function viewRound(round, balanceSats) {
  if (!round) return null;
  const deck = deckFor(round);
  const state = playRound(deck, round.actions, { bet: round.betSats, rules: config.rules });

  if (state.awaiting) {
    state.awaiting = {
      ...state.awaiting,
      legalActions: affordable(state.awaiting, state.awaiting.legalActions, round.betSats, balanceSats),
    };
  }

  return {
    roundId: round.id,
    betSats: round.betSats,
    committedSats: round.committedSats,
    finished: state.finished,
    awaiting: state.awaiting,
    dealer: state.dealer,
    hands: state.hands,
    insurance: state.insurance,
    totalStake: state.totalStake,
    totalReturn: state.totalReturn,
    net: state.net,
    fair: {
      nonce: round.nonce,
      clientSeed: round.clientSeed,
      // per-hand commitment = SHA256(serverSeed) = the prior hash-chain link,
      // known before the deal (the on-chain anchor for nonce 0, else last seed).
      commitment: round.commitment,
      anchor: round.anchor,
      anchorTxid: round.anchorTxid,
      epochLength: round.epochLength,
      // revealed only once the round is over
      serverSeed: state.finished ? round.serverSeed : null,
      deck: state.finished ? deck : null,
      algorithm: "deck = HMAC_SHA256(serverSeed, `${clientSeed}:${nonce}`) -> Fisher-Yates; serverSeed links via SHA-256 chain to the on-chain anchor",
    },
  };
}

function settle(player, round, state) {
  round.finished = true;
  player.balanceSats += state.totalReturn; // gross return (stakes included)

  const wins = state.hands.filter((h) => h.result === "win" || h.result === "blackjack").length;
  pushHistory(player, {
    id: round.id,
    nonce: round.nonce,
    betSats: round.betSats,
    totalStake: state.totalStake,
    net: state.net,
    hands: state.hands.length,
    wins,
    dealer: state.dealer.cards,
    result: state.net > 0 ? "win" : state.net < 0 ? "lose" : "push",
    // everything needed to verify the hand against the on-chain anchor:
    serverSeed: round.serverSeed,
    commitment: round.commitment,
    clientSeed: round.clientSeed,
    anchor: round.anchor,
    anchorTxid: round.anchorTxid,
    epochLength: round.epochLength,
    rules: config.rules,
    finishedAt: new Date().toISOString(),
  });
}

export async function startRound(player, betSats) {
  betSats = Math.floor(betSats);
  if (!Number.isFinite(betSats) || betSats <= 0) throw httpErr(400, "invalid bet");
  if (betSats < config.minBetSats) throw httpErr(400, "bet below minimum");
  if (betSats > config.maxBetSats) throw httpErr(400, "bet above maximum");
  if (player.activeRound && !player.activeRound.finished) {
    throw httpErr(409, "finish the current round first");
  }
  if (player.balanceSats < betSats) throw httpErr(402, "insufficient balance");

  if (!player.clientSeed) player.clientSeed = randomClientSeed();

  // Get (or create + on-chain-anchor) the epoch, then claim this hand's seed.
  const epoch = await ensureEpoch(player);
  const { nonce, serverSeed, commitment } = claimSeed(epoch);

  const round = {
    id: nextId(),
    nonce,
    epochId: epoch.id,
    anchor: epoch.anchor,
    anchorTxid: epoch.anchorTxid,
    epochLength: epoch.length,
    betSats,
    clientSeed: player.clientSeed,
    serverSeed,
    commitment,
    actions: [],
    committedSats: betSats,
    finished: false,
    createdAt: new Date().toISOString(),
  };
  player.balanceSats -= betSats;
  player.activeRound = round;

  // Resolve immediate naturals (player/dealer blackjack) right away.
  const deck = deckFor(round);
  const state = playRound(deck, round.actions, { bet: round.betSats, rules: config.rules });
  if (state.finished) settle(player, round, state);

  save();
  return viewRound(round, player.balanceSats);
}

export function applyAction(player, action) {
  const round = player.activeRound;
  if (!round || round.finished) throw httpErr(409, "no active round");

  const deck = deckFor(round);
  const current = playRound(deck, round.actions, { bet: round.betSats, rules: config.rules });
  if (!current.awaiting) throw httpErr(409, "round is not awaiting input");

  const legal = affordable(current.awaiting, current.awaiting.legalActions, round.betSats, player.balanceSats);
  if (!legal.includes(action)) throw httpErr(400, `illegal action: ${action}`);

  // Apply tentatively to learn the new committed stake (double/split add a bet).
  const next = playRound(deck, [...round.actions, action], {
    bet: round.betSats,
    rules: config.rules,
  });
  const delta = next.totalStake - round.committedSats;
  if (delta > 0) {
    if (player.balanceSats < delta) throw httpErr(402, "insufficient balance for that action");
    player.balanceSats -= delta;
    round.committedSats = next.totalStake;
  }

  round.actions.push(action);
  if (next.finished) settle(player, round, next);

  save();
  return viewRound(round, player.balanceSats);
}

export function setClientSeed(player, clientSeed) {
  if (player.activeRound && !player.activeRound.finished) {
    throw httpErr(409, "cannot change client seed mid-round");
  }
  clientSeed = String(clientSeed ?? "").slice(0, 64).trim();
  if (!clientSeed) throw httpErr(400, "client seed required");
  player.clientSeed = clientSeed;
  save();
  return player.clientSeed;
}

export function httpErr(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}
