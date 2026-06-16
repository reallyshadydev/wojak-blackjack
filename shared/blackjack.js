// Deterministic blackjack engine.
//
// `playRound(deck, actions, opts)` is a PURE function of the shuffled deck and
// the ordered list of player decisions. The house server runs it to drive the
// authoritative game; the player's browser runs the *identical* function during
// verification to confirm every card it was shown came from the committed deck
// and that the payout was computed by the rules. There is exactly one
// implementation of the rules, shared by both sides.

export const DEFAULT_RULES = {
  dealerHitsSoft17: false, // dealer stands on all 17 (S17)
  blackjackPays: 1.5, // 3:2
  maxSplits: 3, // up to 4 hands
  doubleAfterSplit: true,
  oneCardAfterSplitAce: true, // split aces receive exactly one card
};

/** Numeric value of a single card code like "AS","TH". Ace counts as 11 here. */
export function cardValue(code) {
  const r = code[0];
  if (r === "A") return 11;
  if (r === "T" || r === "J" || r === "Q" || r === "K") return 10;
  return Number(r);
}

/** Best blackjack value of a hand: { value, soft, busted }. */
export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardValue(c);
    if (c[0] === "A") aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { value: total, soft: aces > 0, busted: total > 21 };
}

/** True natural blackjack: exactly two cards totalling 21 (pre-split only). */
export function isNatural(cards) {
  return cards.length === 2 && handValue(cards).value === 21;
}

function newHand(cards, stake, isSplit, splitAce) {
  return {
    cards,
    stake,
    doubled: false,
    isSplit: !!isSplit,
    splitAce: !!splitAce,
    status: "playing", // playing | stand | bust | blackjack
  };
}

function legalActions(hand, hands, rules) {
  const acts = ["hit", "stand"];
  const two = hand.cards.length === 2;
  if (two && !hand.splitAce) {
    const dasOk = !hand.isSplit || rules.doubleAfterSplit;
    if (dasOk) acts.push("double");
    const pair = cardValue(hand.cards[0]) === cardValue(hand.cards[1]);
    if (pair && hands.length - 1 < rules.maxSplits) acts.push("split");
  }
  // canonical UI order
  return ["hit", "stand", "double", "split"].filter((a) => acts.includes(a));
}

/**
 * Play a round to whatever point `actions` carries it.
 *
 * @param {string[]} deck    the shuffled 52-card deck (index 0 dealt first)
 * @param {string[]} actions ordered player decisions: hit|stand|double|split
 * @param {object}   opts    { bet=1, rules }
 * @returns full round state (see README "Verifying"); `finished` true once the
 *          dealer has played and every hand is settled.
 */
export function playRound(deck, actions = [], opts = {}) {
  const rules = { ...DEFAULT_RULES, ...(opts.rules || {}) };
  const bet = opts.bet ?? 1;

  let cursor = 0;
  const draw = () => deck[cursor++];

  // Initial deal: player, dealer, player, dealer.
  const hand0 = newHand([], bet, false, false);
  const dealerCards = [];
  hand0.cards.push(draw());
  dealerCards.push(draw());
  hand0.cards.push(draw());
  dealerCards.push(draw());

  const hands = [hand0];
  const dealer = { cards: dealerCards };

  const dealerBlackjack = isNatural(dealerCards);
  const playerBlackjack = isNatural(hand0.cards);

  let finished = false;
  let holeRevealed = false;
  let awaiting = null;
  let actionIdx = 0;

  if (dealerBlackjack) {
    // Dealer can only have a natural with an Ace/ten upcard, which always
    // triggers a peek — so the round ends before the player can act.
    holeRevealed = true;
    hand0.status = playerBlackjack ? "blackjack" : "stand";
    finished = true;
  } else if (playerBlackjack) {
    holeRevealed = true;
    hand0.status = "blackjack";
    finished = true;
  } else {
    // Interactive player phase.
    for (;;) {
      const active = hands.findIndex((h) => h.status === "playing");
      if (active === -1) break; // all player hands resolved

      const hand = hands[active];
      const hv = handValue(hand.cards);
      if (hv.busted) {
        hand.status = "bust";
        continue;
      }
      if (hv.value === 21) {
        hand.status = "stand"; // auto-stand on 21
        continue;
      }
      if (hand.splitAce && rules.oneCardAfterSplitAce && hand.cards.length >= 2) {
        hand.status = "stand"; // split aces take one card only
        continue;
      }

      if (actionIdx >= actions.length) {
        awaiting = { index: active, legalActions: legalActions(hand, hands, rules) };
        break;
      }

      const action = actions[actionIdx++];
      applyAction(action, hand, active, hands, rules, bet, draw);
    }

    if (!awaiting) {
      // Dealer's turn.
      holeRevealed = true;
      if (hands.some((h) => h.status !== "bust")) {
        for (;;) {
          const dv = handValue(dealer.cards);
          const hitSoft17 = dv.value === 17 && dv.soft && rules.dealerHitsSoft17;
          if (dv.value < 17 || hitSoft17) {
            dealer.cards.push(draw());
            continue;
          }
          break;
        }
      }
      finished = true;
    }
  }

  if (finished) settle(hands, dealer, rules);

  return buildState({ hands, dealer, rules, bet, finished, holeRevealed, awaiting, cursor });
}

function applyAction(action, hand, index, hands, rules, bet, draw) {
  const legal = legalActions(hand, hands, rules);
  if (!legal.includes(action)) {
    throw new Error(`illegal action "${action}" (legal: ${legal.join(", ")})`);
  }

  if (action === "hit") {
    hand.cards.push(draw());
  } else if (action === "stand") {
    hand.status = "stand";
  } else if (action === "double") {
    hand.doubled = true;
    hand.stake = bet * 2;
    hand.cards.push(draw());
    hand.status = "stand";
  } else if (action === "split") {
    const moved = hand.cards.pop();
    const split = newHand([moved], bet, true, moved[0] === "A");
    hand.isSplit = true;
    hand.splitAce = hand.cards[0][0] === "A";
    // Deal one card to each new hand, original first (left-to-right).
    hand.cards.push(draw());
    split.cards.push(draw());
    hands.splice(index + 1, 0, split);
  }
}

function settle(hands, dealer, rules) {
  const dv = handValue(dealer.cards);
  const dealerBust = dv.busted;
  const dealerNatural = isNatural(dealer.cards);

  for (const hand of hands) {
    const hv = handValue(hand.cards);
    let result;
    let mult; // multiple of the hand's stake returned (stake included)

    if (hand.status === "blackjack") {
      if (dealerNatural) {
        result = "push";
        mult = 1;
      } else {
        result = "blackjack";
        mult = 1 + rules.blackjackPays; // e.g. 2.5
      }
    } else if (hv.busted) {
      result = "lose";
      mult = 0;
    } else if (dealerBust || hv.value > dv.value) {
      result = "win";
      mult = 2;
    } else if (hv.value < dv.value) {
      result = "lose";
      mult = 0;
    } else {
      result = "push";
      mult = 1;
    }

    hand.result = result;
    hand.returnMult = mult;
    // Floor to whole satoshis so the server and the in-browser verifier agree
    // exactly even when a 3:2 blackjack lands on an odd stake.
    hand.return = Math.floor(hand.stake * mult);
  }
}

function describeHand(hand) {
  const hv = handValue(hand.cards);
  return {
    cards: [...hand.cards],
    value: hv.value,
    soft: hv.soft,
    busted: hv.busted,
    blackjack: !hand.isSplit && isNatural(hand.cards),
    doubled: hand.doubled,
    isSplit: hand.isSplit,
    splitAce: hand.splitAce,
    stake: hand.stake,
    status: hand.status,
    result: hand.result ?? null,
    returnMult: hand.returnMult ?? null,
    return: hand.return ?? null,
  };
}

function buildState({ hands, dealer, rules, bet, finished, holeRevealed, awaiting, cursor }) {
  const dealerCards = holeRevealed ? dealer.cards : [dealer.cards[0]];
  const dv = handValue(dealerCards);

  const handViews = hands.map(describeHand);
  const totalStake = handViews.reduce((s, h) => s + h.stake, 0);
  const totalReturn = finished
    ? handViews.reduce((s, h) => s + (h.return ?? 0), 0)
    : 0;

  return {
    rules,
    bet,
    finished,
    awaiting,
    cursor,
    dealer: {
      cards: dealerCards,
      value: dv.value,
      soft: dv.soft,
      busted: holeRevealed && dv.busted,
      blackjack: holeRevealed && isNatural(dealer.cards),
      holeRevealed,
      hidden: holeRevealed ? 0 : 1,
    },
    hands: handViews,
    totalStake,
    totalReturn,
    net: finished ? totalReturn - totalStake : 0,
  };
}
