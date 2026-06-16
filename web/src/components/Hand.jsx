import Card from "./Card.jsx";

const RESULT_STYLE = {
  win: "bg-emerald-400 text-emerald-950",
  blackjack: "bg-gold text-ink",
  lose: "bg-rose-500/90 text-white",
  push: "bg-slate-300 text-slate-900",
};
const RESULT_LABEL = {
  win: "WIN",
  blackjack: "BLACKJACK",
  lose: "LOSE",
  push: "PUSH",
};

/**
 * A hand of cards with a value badge and (when settled) a result chip.
 * `hand.cards`, `hand.value`, `hand.result`, plus a `hidden` count for the
 * dealer's face-down hole card.
 */
export default function Hand({ cards = [], value, soft, result, busted, blackjack, hiddenCount = 0, active, stake, size = 76, label }) {
  return (
    <div className={`flex flex-col items-center gap-2 transition ${active ? "scale-[1.03]" : ""}`}>
      <div className="flex items-end" style={{ minHeight: size * 1.4 }}>
        {cards.map((c, i) => (
          <div key={i} style={{ marginLeft: i === 0 ? 0 : -size * 0.42 }}>
            <Card code={c} index={i} size={size} />
          </div>
        ))}
        {Array.from({ length: hiddenCount }).map((_, i) => (
          <div key={`h${i}`} style={{ marginLeft: cards.length + i === 0 ? 0 : -size * 0.42 }}>
            <Card faceDown index={cards.length + i} size={size} />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {value != null && (
          <span
            className={`tabular rounded-full px-2.5 py-0.5 text-sm font-bold ${
              busted ? "bg-rose-500 text-white" : blackjack ? "bg-gold text-ink" : "bg-black/45 text-gold ring-1 ring-gold/30"
            }`}
          >
            {hiddenCount ? `${value}+` : value}
            {soft && !busted && !hiddenCount ? " ⟂" : ""}
          </span>
        )}
        {label && <span className="text-xs uppercase tracking-widest text-white/40">{label}</span>}
        {result && (
          <span className={`animate-pop rounded-full px-2.5 py-0.5 text-xs font-extrabold tracking-wider ${RESULT_STYLE[result]}`}>
            {RESULT_LABEL[result]}
          </span>
        )}
      </div>
    </div>
  );
}
