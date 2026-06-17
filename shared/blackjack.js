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
  doubleAfterSplit: true, // allowed except on split-ace hands
  oneCardAfterSplitAce: true, // split aces receive exactly one card, then stand
  noResplitAces: true, // cannot split aces twice
  insuranceOffered: true, // offer insurance when dealer shows an Ace
  insurancePays: 2, // 2:1 on the insurance wager
};

/** Numeric value of a single card code like "AS","TH". Ace counts as 11 here. */
export function cardValue(code) {
  const r = code[0];
  if (r === "A") return 11;
  if (r === "T" || r === "J" || r === "Q" || r === "K") return 10;
  return Number(r);
}

function cardRank(code) {
  return code[0];
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
  // Split-ace hands auto-stand after one card — no further actions.
  if (hand.splitAce) return [];

  const acts = ["hit", "stand"];
  const two = hand.cards.length === 2;
  if (two) {
    const dasOk = !hand.isSplit || (rules.doubleAfterSplit && !hand.splitAce);
    if (dasOk) acts.push("double");
    const pair = cardValue(hand.cards[0]) === cardValue(hand.cards[1]);
    const isAcePair = cardRank(hand.cards[0]) === "A";
    const aceResplitBlocked = rules.noResplitAces && hand.isSplit && isAcePair;
    if (pair && hands.length - 1 < rules.maxSplits && !aceResplitBlocked) {
      acts.push("split");
    }
  }
  return ["hit", "stand", "double", "split"].filter((a) => acts.includes(a));
}

function insuranceStake(bet) {
  return Math.floor(bet / 2);
}

/**
 * Play a round to whatever point `actions` carries it.
 *
 * @param {string[]} deck    the shuffled 52-card deck (index 0 dealt first)
 * @param {string[]} actions ordered player decisions:
 *   insurance|no_insurance (when offered), then hit|stand|double|split
 * @param {object}   opts    { bet=1, rules }
 * @returns full round state (see README "Verifying"); `finished` true once the
 *          dealer has played and every hand is settled.
 */
export function playRound(deck, actions = [], opts = {}) {
  const rules = { ...DEFAULT_RULES, ...(opts.rules || {}) };
  const bet = opts.bet ?? 1;

  let cursor = 0;
  const draw = () => deck[cursor++];

  const hand0 = newHand([], bet, false, false);
  const dealerCards = [];
  hand0.cards.push(draw());
  dealerCards.push(draw());
  hand0.cards.push(draw());
  dealerCards.push(draw());

  const hands = [hand0];
  const dealer = { cards: dealerCards };

  const dealerNatural = isNatural(dealerCards);
  const playerNatural = isNatural(hand0.cards);
  const dealerAceUp = cardRank(dealerCards[0]) === "A";

  let insurance = { taken: false, stake: 0, return: 0 };
  let insuranceResolved = !rules.insuranceOffered || !dealerAceUp || playerNatural;

  let finished = false;
  let holeRevealed = false;
  let awaiting = null;
  let actionIdx = 0;

  if (playerNatural) {
    holeRevealed = true;
    hand0.status = "blackjack";
    finished = true;
  } else if (dealerNatural && !dealerAceUp) {
    // Ten-value upcard BJ: peek ends the round before insurance is offered.
    holeRevealed = true;
    hand0.status = "stand";
    finished = true;
  } else {
    for (;;) {
      if (!insuranceResolved) {
        if (actionIdx >= actions.length) {
          awaiting = {
            phase: "insurance",
            index: 0,
            legalActions: ["insurance", "no_insurance"],
            insuranceStake: insuranceStake(bet),
          };
          break;
        }
        const insAct = actions[actionIdx++];
        if (insAct === "insurance") {
          insurance.taken = true;
          insurance.stake = insuranceStake(bet);
        } else if (insAct === "no_insurance") {
          insurance.taken = false;
          insurance.stake = 0;
        } else {
          throw new Error(`illegal action "${insAct}" during insurance (legal: insurance, no_insurance)`);
        }
        insuranceResolved = true;
        holeRevealed = true;
        if (dealerNatural) {
          hand0.status = "stand";
          finished = true;
          break;
        }
        continue;
      }

      const active = hands.findIndex((h) => h.status === "playing");
      if (active === -1) break;

      const hand = hands[active];
      const hv = handValue(hand.cards);
      if (hv.busted) {
        hand.status = "bust";
        continue;
      }
      if (hv.value === 21) {
        hand.status = "stand";
        continue;
      }
      if (hand.splitAce && rules.oneCardAfterSplitAce && hand.cards.length >= 2) {
        hand.status = "stand";
        continue;
      }

      if (actionIdx >= actions.length) {
        awaiting = {
          phase: "play",
          index: active,
          legalActions: legalActions(hand, hands, rules),
        };
        break;
      }

      const action = actions[actionIdx++];
      applyAction(action, hand, active, hands, rules, bet, draw);
    }

    if (!awaiting && !finished) {
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

  if (finished) settle(hands, dealer, rules, insurance);

  return buildState({
    hands,
    dealer,
    rules,
    bet,
    finished,
    holeRevealed,
    awaiting,
    cursor,
    insurance,
    insuranceResolved,
  });
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
    hand.cards.push(draw());
    split.cards.push(draw());
    hands.splice(index + 1, 0, split);
  }
}

function settle(hands, dealer, rules, insurance) {
  const dv = handValue(dealer.cards);
  const dealerBust = dv.busted;
  const dealerNatural = isNatural(dealer.cards);

  if (insurance.taken) {
    insurance.return = dealerNatural
      ? Math.floor(insurance.stake * (1 + rules.insurancePays))
      : 0;
  }

  for (const hand of hands) {
    const hv = handValue(hand.cards);
    let result;
    let mult;

    if (hand.status === "blackjack") {
      if (dealerNatural) {
        result = "push";
        mult = 1;
      } else {
        result = "blackjack";
        mult = 1 + rules.blackjackPays;
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

function buildState({
  hands,
  dealer,
  rules,
  bet,
  finished,
  holeRevealed,
  awaiting,
  cursor,
  insurance,
  insuranceResolved,
}) {
  const dealerCards = holeRevealed ? dealer.cards : [dealer.cards[0]];
  const dv = handValue(dealerCards);

  const handViews = hands.map(describeHand);
  const insuranceStakeLive = insurance.taken ? insurance.stake : 0;
  const totalStake = handViews.reduce((s, h) => s + h.stake, 0) + insuranceStakeLive;
  const insuranceReturn = finished ? insurance.return ?? 0 : 0;
  const totalReturn = finished
    ? handViews.reduce((s, h) => s + (h.return ?? 0), 0) + insuranceReturn
    : 0;

  return {
    rules,
    bet,
    finished,
    awaiting,
    cursor,
    insurance: insuranceResolved
      ? {
          taken: insurance.taken,
          stake: insurance.stake,
          return: finished ? insurance.return : null,
          resolved: true,
        }
      : null,
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
