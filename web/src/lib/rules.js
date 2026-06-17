/** Human-readable felt labels for the active blackjack rules. */
export function formatBlackjackPays(multiplier) {
  if (multiplier === 1.5) return "3 TO 2";
  if (multiplier === 1.2) return "6 TO 5";
  return `${multiplier} TO 1`;
}

export function formatDealerRule(dealerHitsSoft17) {
  return dealerHitsSoft17 ? "DEALER HITS SOFT 17" : "DEALER STANDS ON ALL 17";
}

export function formatTableRules(rules = {}) {
  const parts = [formatDealerRule(!!rules.dealerHitsSoft17)];
  if (rules.insuranceOffered !== false) parts.push("INSURANCE 2 TO 1");
  else parts.push("INSURANCE NOT OFFERED");
  if (rules.doubleAfterSplit !== false) parts.push("DOUBLE AFTER SPLIT (NOT ACES)");
  if (rules.noResplitAces !== false) parts.push("NO RESPLIT ACES");
  return parts.join(" · ");
}
