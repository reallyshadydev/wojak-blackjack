import Hand from "./Hand.jsx";
import { fmtWJK, formatInsuranceBreakdown } from "../lib/format.js";
import { formatBlackjackPays, formatTableRules } from "../lib/rules.js";
import { useCardSizes } from "../hooks/useViewport.js";

function Shoe({ compact }) {
  if (compact) return null;
  return (
    <div className="absolute right-3 top-3 hidden sm:block">
      <div className="relative h-12 w-10">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="card-back absolute rounded-md"
            style={{ width: 36, height: 50, top: -i * 2, left: i * 1.5, opacity: 0.9 }}
          />
        ))}
      </div>
    </div>
  );
}

export default function Table({ round, phase, lastNet, rules }) {
  const activeIndex = round?.awaiting?.index;
  const { dealer: dealerSize, player: playerSize } = useCardSizes();
  const compact = dealerSize <= 52;
  const handCount = round?.hands?.length ?? 1;

  return (
    <div className="relative mx-auto flex h-full w-full max-w-5xl flex-col">
      <div className="felt felt-noise relative flex min-h-0 flex-1 flex-col justify-between overflow-hidden rounded-3xl px-3 py-2.5 sm:rounded-[32px] sm:px-5 sm:py-4 lg:py-5">
        <Shoe compact={compact} />

        {/* Dealer */}
        <div className="flex shrink-0 flex-col items-center gap-0.5">
          <div className="text-[10px] uppercase tracking-[0.25em] text-white/35">Dealer</div>
          <div className="flex min-h-0 items-end justify-center" style={{ minHeight: dealerSize * 1.45 }}>
            {round ? (
              <Hand
                cards={round.dealer.cards}
                value={round.dealer.holeRevealed ? round.dealer.value : round.dealer.value}
                soft={round.dealer.soft}
                busted={round.dealer.busted}
                blackjack={round.dealer.blackjack}
                hiddenCount={round.dealer.hidden}
                size={dealerSize}
              />
            ) : (
              <div className="grid place-items-center text-sm text-white/25" style={{ height: dealerSize * 1.4 }}>
                — waiting —
              </div>
            )}
          </div>
        </div>

        {/* Center band */}
        <div className="flex shrink-0 flex-col items-center justify-center gap-1 py-1">
          {round?.insurance?.taken && !round?.finished && (
            <div className="rounded-full bg-violet-500/20 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-200 ring-1 ring-violet-400/30 sm:text-xs">
              Insurance {fmtWJK(round.insurance.stake)} WJK
            </div>
          )}
          {round?.finished ? (
            <div className="flex flex-col items-center gap-1">
              <div
                className={`animate-pop rounded-full px-4 py-1.5 font-display text-lg tracking-wide shadow-lg sm:px-6 sm:py-2 sm:text-2xl ${
                  lastNet > 0
                    ? "bg-emerald-400 text-emerald-950"
                    : lastNet < 0
                    ? "bg-rose-500 text-white"
                    : "bg-slate-200 text-slate-900"
                }`}
              >
                {lastNet > 0
                  ? `NET WIN  +${fmtWJK(lastNet)} WJK`
                  : lastNet < 0
                  ? `NET LOSS  ${fmtWJK(lastNet)} WJK`
                  : "PUSH"}
              </div>
              {round.insurance?.taken && (
                <div className="text-center text-[10px] text-white/55 sm:text-xs">
                  {formatInsuranceBreakdown(round)}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="arc-text text-center font-display text-sm sm:text-base">
                BLACKJACK PAYS {formatBlackjackPays(rules?.blackjackPays ?? 1.5)}
              </div>
              {!compact && (
                <>
                  <div className="my-1 h-px w-2/3 bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
                  <div className="arc-text max-w-md text-center text-[9px] leading-snug sm:text-[10px]">
                    {formatTableRules(rules)}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Player */}
        <div
          className={`flex shrink-0 flex-wrap items-end justify-center gap-3 sm:gap-4 ${
            handCount > 2 ? "gap-2" : ""
          }`}
          style={{ minHeight: playerSize * 1.6 }}
        >
          {round ? (
            round.hands.map((h, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <Hand
                  cards={h.cards}
                  value={h.value}
                  soft={h.soft}
                  busted={h.busted}
                  blackjack={h.blackjack}
                  result={round.finished ? h.result : null}
                  active={phase === "playing" && i === activeIndex}
                  size={handCount > 2 ? Math.max(playerSize - 8, 40) : playerSize}
                />
                <div className="flex flex-wrap items-center justify-center gap-1.5 text-[10px] text-white/45 sm:text-xs">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-gradient-to-br from-gold to-gold-dark" />
                  {fmtWJK(h.stake)} WJK
                  {h.doubled && <span className="text-gold">· 2×</span>}
                  {round.hands.length > 1 && <span className="text-white/30">· {i + 1}</span>}
                  {i === 0 && round.insurance?.taken && (
                    <span className="text-violet-300">· Ins {fmtWJK(round.insurance.stake)}</span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="grid place-items-center text-center text-white/30">
              <div>
                <div className="font-display text-xl text-white/40 sm:text-2xl">Place your bet</div>
                <div className="text-xs sm:text-sm">Pick chips below and hit Deal</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
