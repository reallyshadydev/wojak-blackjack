import { fmtWJK, toWJK } from "../lib/format.js";
import { sound } from "../lib/sounds.js";

const CHIPS = [
  { v: 0.5, c1: "#475569", c2: "#94a3b8", label: "0.5" },
  { v: 1, c1: "#1d4ed8", c2: "#60a5fa", label: "1" },
  { v: 5, c1: "#b91c1c", c2: "#f87171", label: "5" },
  { v: 25, c1: "#15803d", c2: "#4ade80", label: "25" },
  { v: 100, c1: "#7e22ce", c2: "#c084fc", label: "100" },
];

const ACTION_STYLE = {
  hit: "bg-emerald-500 text-emerald-950 hover:bg-emerald-400",
  stand: "bg-rose-500 text-white hover:bg-rose-400",
  double: "bg-gold text-ink hover:brightness-110",
  split: "bg-sky-400 text-sky-950 hover:bg-sky-300",
  surrender: "bg-white/15 text-white/90 hover:bg-white/25",
  insurance: "bg-violet-500 text-white hover:bg-violet-400",
  no_insurance: "bg-white/10 text-white hover:bg-white/15",
};
const ACTION_LABEL = {
  hit: "Hit",
  stand: "Stand",
  double: "Double",
  split: "Split",
  surrender: "Surrender",
  insurance: "Insurance",
  no_insurance: "No thanks",
};

export default function Controls({
  phase,
  betSats,
  setBetSats,
  minBetSats,
  maxBetSats,
  balanceSats,
  legalActions = [],
  onDeal,
  onAction,
  onRebet,
  busy,
  connected,
  insurance,
  evenMoney,
}) {
  const addChip = (wjk) => {
    sound.chip();
    const next = Math.min(betSats + wjk * 1e8, maxBetSats, balanceSats);
    setBetSats(Math.max(next, 0));
  };

  if (phase === "insurance") {
    const half = Math.floor(betSats / 2);
    const order = ["insurance", "no_insurance"];
    // Insurance offered to a player who already has blackjack IS "even money".
    const label = (a) => {
      if (evenMoney) return a === "insurance" ? "Even money (1:1)" : "Keep 3:2";
      return a === "insurance" ? `${ACTION_LABEL[a]} (${fmtWJK(half)})` : ACTION_LABEL[a];
    };
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="text-center text-xs text-white/55 sm:text-sm">
          {evenMoney
            ? "You have blackjack and the dealer shows an Ace — take even money (guaranteed 1:1)?"
            : "Dealer shows an Ace — take insurance? Pays 2:1 if dealer has blackjack."}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {order.map((a) => (
            <button
              key={a}
              disabled={busy || !legalActions.includes(a) || (a === "insurance" && balanceSats < half)}
              onClick={() => onAction(a)}
              className={`btn-action min-w-[130px] text-base shadow-card ${ACTION_STYLE[a]}`}
            >
              {label(a)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (phase === "playing") {
    const order = ["hit", "stand", "double", "split", "surrender"];
    return (
      <div className="flex flex-col items-center gap-2">
        {insurance?.taken && (
          <div className="text-xs text-violet-300">Insurance {fmtWJK(insurance.stake)} WJK active</div>
        )}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        {order.map((a) => (
          <button
            key={a}
            disabled={busy || !legalActions.includes(a)}
            onClick={() => onAction(a)}
            className={`btn-action btn-action-compact min-w-[96px] text-sm shadow-card sm:min-w-[110px] sm:text-base ${ACTION_STYLE[a]}`}
          >
            {ACTION_LABEL[a]}
          </button>
        ))}
        </div>
      </div>
    );
  }

  // betting + settled share the chip/deal UI
  const canDeal = connected && betSats >= minBetSats && betSats <= balanceSats && !busy;

  return (
    <div className="flex flex-col items-center gap-2 sm:gap-3">
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        {CHIPS.map((ch) => (
          <button
            key={ch.v}
            disabled={!connected || busy || betSats + ch.v * 1e8 > balanceSats}
            onClick={() => addChip(ch.v)}
            className="chip chip-compact disabled:cursor-not-allowed disabled:opacity-30"
            style={{ "--c1": ch.c1, "--c2": ch.c2 }}
            title={`Add ${ch.label} WJK`}
          >
            <span>{ch.label}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        <div className="glass flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full px-3 py-1.5 sm:gap-3 sm:px-4 sm:py-2">
          <span className="text-[10px] uppercase tracking-wider text-white/40 sm:text-xs">Bet</span>
          <span className="tabular font-display text-xl text-gold sm:text-2xl">{fmtWJK(betSats)}</span>
          <span className="text-sm text-white/40">WJK</span>
          {insurance?.taken && (
            <span className="text-xs text-violet-300 sm:text-sm">+ Ins {fmtWJK(insurance.stake)}</span>
          )}
          <button
            onClick={() => setBetSats(0)}
            disabled={busy || betSats === 0}
            className="ml-1 rounded-full bg-white/5 px-2 py-1 text-xs text-white/60 hover:bg-white/10 disabled:opacity-30"
          >
            Clear
          </button>
          <button
            onClick={() => setBetSats(Math.min(maxBetSats, balanceSats))}
            disabled={busy || !connected}
            className="rounded-full bg-white/5 px-2 py-1 text-xs text-white/60 hover:bg-white/10 disabled:opacity-30"
          >
            Max
          </button>
        </div>

        <button
          onClick={onDeal}
          disabled={!canDeal}
          className="btn-action btn-action-compact min-w-[120px] bg-gradient-to-br from-gold to-gold-dark text-base font-extrabold text-ink shadow-glow hover:brightness-105 sm:min-w-[140px] sm:text-lg"
        >
          {phase === "settled" ? "Deal again" : "Deal"}
        </button>
      </div>

      {connected && betSats > 0 && betSats < minBetSats && (
        <div className="text-xs text-amber-300/80">Minimum bet is {fmtWJK(minBetSats)} WJK</div>
      )}
      {!connected && (
        <div className="text-xs text-white/40">Connect your Wojak Wallet to play</div>
      )}
    </div>
  );
}
