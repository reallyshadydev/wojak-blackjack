import Modal from "./Modal.jsx";
import { formatBlackjackPays } from "../lib/rules.js";

function Section({ title, children }) {
  return (
    <div className="mb-3">
      <h4 className="mb-1 font-display text-sm uppercase tracking-wider text-gold">{title}</h4>
      <div className="space-y-1 text-sm leading-relaxed text-white/75">{children}</div>
    </div>
  );
}

function Row({ k, v, good }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 py-1 last:border-0">
      <span className="text-white/55">{k}</span>
      <span className={`font-mono text-xs ${good === true ? "text-emerald-300" : good === false ? "text-amber-300" : "text-white/85"}`}>
        {v}
      </span>
    </div>
  );
}

/** Full standard blackjack rules, with this table's active variant highlighted. */
export default function RulesModal({ open, onClose, rules = {}, minBet, maxBet }) {
  const r = {
    decks: 1,
    dealerHitsSoft17: false,
    blackjackPays: 1.5,
    maxSplits: 3,
    doubleAfterSplit: true,
    oneCardAfterSplitAce: true,
    noResplitAces: true,
    lateSurrender: true,
    insuranceOffered: true,
    insurancePays: 2,
    ...rules,
  };

  return (
    <Modal open={open} onClose={onClose} title="How to play · Blackjack rules">
      <div className="max-h-[70vh] space-y-1 overflow-y-auto pr-1 scrollbar-thin">
        <Section title="Objective">
          Beat the dealer by getting a hand total closer to <b>21</b> than the dealer without going
          over. Go over 21 and you <b>bust</b> (instant loss). If the dealer busts and you didn’t,
          you win.
        </Section>

        <Section title="Card values">
          <div>• 2–10 are face value.</div>
          <div>• J, Q, K each count as 10.</div>
          <div>• An Ace is 1 or 11 — whichever is better. A hand using an 11-Ace is “soft”.</div>
          <div className="text-white/50">e.g. A+6 = soft 17 · 10+6 = hard 16 · A+A+9 = soft 21.</div>
        </Section>

        <Section title="This table">
          <div className="rounded-lg bg-black/30 px-3 py-1.5 ring-1 ring-white/5">
            <Row k="Blackjack pays" v={formatBlackjackPays(r.blackjackPays)} good={r.blackjackPays === 1.5} />
            <Row k="Dealer on soft 17" v={r.dealerHitsSoft17 ? "Hits (H17)" : "Stands (S17)"} good={!r.dealerHitsSoft17} />
            <Row k="Decks in shoe" v={`${r.decks} (reshuffled each hand)`} />
            <Row k="Double down" v="Any first two cards" good />
            <Row k="Double after split" v={r.doubleAfterSplit ? "Allowed" : "Not allowed"} good={r.doubleAfterSplit} />
            <Row k="Split to" v={`${r.maxSplits + 1} hands`} />
            <Row k="Split aces" v={`One card each${r.noResplitAces ? ", no resplit" : ""}`} />
            <Row k="Late surrender" v={r.lateSurrender ? "Offered (lose half)" : "Not offered"} good={r.lateSurrender} />
            <Row k="Insurance / even money" v={r.insuranceOffered ? `Offered (pays ${r.insurancePays}:1)` : "Not offered"} />
            {minBet != null && <Row k="Bet limits" v={`${minBet} – ${maxBet} WJK`} />}
          </div>
        </Section>

        <Section title="Your options">
          <div>• <b>Hit</b> — take another card (any number of times).</div>
          <div>• <b>Stand</b> — keep your total and end your turn.</div>
          <div>• <b>Double</b> — double your bet and take exactly one more card.</div>
          <div>• <b>Split</b> — a pair becomes two hands, each gets a second card and matches your bet.</div>
          {r.lateSurrender && (
            <div>• <b>Surrender</b> — give up your first two cards and lose only half your bet.</div>
          )}
        </Section>

        <Section title="Dealer rules (fixed)">
          <div>• Dealer hits 16 or less, stands on 17+.</div>
          <div>• On soft 17 the dealer {r.dealerHitsSoft17 ? "hits (H17)" : "stands (S17)"}.</div>
          <div>• The dealer peeks for blackjack on an Ace or 10 upcard before you act.</div>
        </Section>

        <Section title="Insurance & even money">
          <div>
            When the dealer shows an Ace you may take <b>insurance</b> (up to half your bet), which
            pays {r.insurancePays}:1 if the dealer has blackjack.
          </div>
          <div>
            If <i>you</i> have a blackjack vs an Ace, the same choice is offered as <b>even money</b> —
            a guaranteed 1:1 instead of risking a push.
          </div>
        </Section>

        <Section title="Payouts">
          <Row k="Blackjack (first two cards)" v={formatBlackjackPays(r.blackjackPays)} />
          <Row k="Win / dealer busts" v="1:1" />
          <Row k="Push (tie)" v="Bet returned" />
          <Row k="Surrender" v="Lose half" />
          <Row k="Bust / lose" v="Lose bet" />
        </Section>

        <Section title="Provably fair">
          Every shoe is shuffled from seeds committed to a single on-chain anchor before the deal,
          and the server seed is revealed at the end of each hand — so you can verify the exact deck
          yourself from the blockchain. See the Provably-Fair panel.
        </Section>
      </div>
    </Modal>
  );
}
