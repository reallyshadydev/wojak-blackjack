import Hand from "./Hand.jsx";
import { fmtWJK } from "../lib/format.js";

function Shoe() {
  return (
    <div className="absolute right-6 top-6 hidden sm:block">
      <div className="relative h-16 w-12">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="card-back absolute rounded-md"
            style={{ width: 44, height: 62, top: -i * 2, left: i * 1.5, opacity: 0.9 }}
          />
        ))}
      </div>
    </div>
  );
}

export default function Table({ round, phase, lastNet }) {
  const activeIndex = round?.awaiting?.index;

  return (
    <div className="relative mx-auto w-full max-w-5xl">
      <div className="felt felt-noise relative overflow-hidden rounded-[44px] px-6 py-8 sm:px-10 sm:py-10">
        <Shoe />

        {/* Dealer */}
        <div className="flex flex-col items-center gap-1">
          <div className="text-[11px] uppercase tracking-[0.3em] text-white/35">Dealer</div>
          <div className="min-h-[120px]">
            {round ? (
              <Hand
                cards={round.dealer.cards}
                value={round.dealer.holeRevealed ? round.dealer.value : round.dealer.value}
                soft={round.dealer.soft}
                busted={round.dealer.busted}
                blackjack={round.dealer.blackjack}
                hiddenCount={round.dealer.hidden}
                size={70}
              />
            ) : (
              <div className="grid h-[110px] place-items-center text-white/25">— waiting —</div>
            )}
          </div>
        </div>

        {/* Center band: table rules, or the round result once settled. */}
        <div className="my-3 flex min-h-[64px] flex-col items-center justify-center">
          {round?.finished ? (
            <div
              className={`animate-pop rounded-full px-6 py-2 font-display text-2xl tracking-wide shadow-lg sm:text-3xl ${
                lastNet > 0
                  ? "bg-emerald-400 text-emerald-950"
                  : lastNet < 0
                  ? "bg-rose-500 text-white"
                  : "bg-slate-200 text-slate-900"
              }`}
            >
              {lastNet > 0
                ? `YOU WIN  +${fmtWJK(lastNet)} WJK`
                : lastNet < 0
                ? `DEALER WINS  ${fmtWJK(lastNet)} WJK`
                : "PUSH"}
            </div>
          ) : (
            <>
              <div className="arc-text font-display text-base sm:text-lg">BLACKJACK PAYS 3 TO 2</div>
              <div className="my-2 h-px w-2/3 bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
              <div className="arc-text text-[10px] sm:text-xs">DEALER MUST STAND ON 17 · INSURANCE NOT OFFERED</div>
            </>
          )}
        </div>

        {/* Player */}
        <div className="flex min-h-[150px] flex-wrap items-start justify-center gap-6">
          {round ? (
            round.hands.map((h, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <Hand
                  cards={h.cards}
                  value={h.value}
                  soft={h.soft}
                  busted={h.busted}
                  blackjack={h.blackjack}
                  result={round.finished ? h.result : null}
                  active={phase === "playing" && i === activeIndex}
                  size={72}
                />
                <div className="flex items-center gap-1.5 text-xs text-white/45">
                  <span className="inline-block h-3 w-3 rounded-full bg-gradient-to-br from-gold to-gold-dark" />
                  {fmtWJK(h.stake)} WJK
                  {h.doubled && <span className="text-gold">· 2×</span>}
                  {round.hands.length > 1 && <span className="text-white/30">· hand {i + 1}</span>}
                </div>
              </div>
            ))
          ) : (
            <div className="grid h-[120px] place-items-center text-center text-white/30">
              <div>
                <div className="font-display text-3xl text-white/40">Place your bet</div>
                <div className="text-sm">Pick chips below and hit Deal</div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
