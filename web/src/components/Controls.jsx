import { fmtWJK, toWJK } from "../lib/format.js";

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
};
const ACTION_LABEL = { hit: "Hit", stand: "Stand", double: "Double", split: "Split" };

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
}) {
  const addChip = (wjk) => {
    const next = Math.min(betSats + wjk * 1e8, maxBetSats, balanceSats);
    setBetSats(Math.max(next, 0));
  };

  if (phase === "playing") {
    const order = ["hit", "stand", "double", "split"];
    return (
      <div className="flex flex-wrap items-center justify-center gap-3">
        {order.map((a) => (
          <button
            key={a}
            disabled={busy || !legalActions.includes(a)}
            onClick={() => onAction(a)}
            className={`btn-action min-w-[110px] text-base shadow-card ${ACTION_STYLE[a]}`}
          >
            {ACTION_LABEL[a]}
          </button>
        ))}
      </div>
    );
  }

  // betting + settled share the chip/deal UI
  const canDeal = connected && betSats >= minBetSats && betSats <= balanceSats && !busy;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-3">
        {CHIPS.map((ch) => (
          <button
            key={ch.v}
            disabled={!connected || busy || betSats + ch.v * 1e8 > balanceSats}
            onClick={() => addChip(ch.v)}
            className="chip disabled:cursor-not-allowed disabled:opacity-30"
            style={{ "--c1": ch.c1, "--c2": ch.c2 }}
            title={`Add ${ch.label} WJK`}
          >
            <span>{ch.label}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <div className="glass flex items-center gap-3 rounded-full px-4 py-2">
          <span className="text-xs uppercase tracking-wider text-white/40">Bet</span>
          <span className="tabular font-display text-2xl text-gold">{fmtWJK(betSats)}</span>
          <span className="text-sm text-white/40">WJK</span>
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
          className="btn-action min-w-[140px] bg-gradient-to-br from-gold to-gold-dark text-lg font-extrabold text-ink shadow-glow hover:brightness-105"
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
